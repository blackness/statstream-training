import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, Plus, Pencil, Trash2, Globe, User, GripVertical, Check } from 'lucide-react'
import {
  getDrillTemplates, createDrillTemplate,
  updateDrillTemplate, deleteDrillTemplate,
  saveDrillTemplateOrder, getPlayers,
} from '../../lib/basketballClient'

const BLANK = {
  name: '', total_attempts: '', contested: false,
  goal_percent: '', is_global: true, owner_player_id: null,
  drill_type: 'attempt_count', required_makes: '',
}

function SortableTemplateRow({ template, onEdit, onDelete }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: template.id })

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : 0 }
  const isMakeCount = template.drill_type === 'make_count'

  return (
    <div ref={setNodeRef} style={style}
      className={`bg-gray-900 rounded-xl p-4 border transition-all ${isDragging ? 'border-orange-500 shadow-xl' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div {...attributes} {...listeners}
            className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none p-1 flex-shrink-0">
            <GripVertical size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{template.name}</span>
              {template.is_global
                ? <Globe size={12} className="text-blue-400 flex-shrink-0" />
                : <User  size={12} className="text-orange-400 flex-shrink-0" />}
            </div>
            <div className="text-xs text-gray-400 mt-1 flex gap-2 flex-wrap">
              {isMakeCount
                ? <span className="text-purple-400">make {template.required_makes} shots</span>
                : <span>{template.total_attempts} attempts</span>}
              {template.contested    && <span>· contested</span>}
              {template.goal_percent && <span>· goal {template.goal_percent}%</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 ml-3 flex-shrink-0">
          <button onClick={() => onEdit(template)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(template.id)}
            className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DrillTemplates() {
  const navigate = useNavigate()
  const [templates, setTemplates]       = useState([])
  const [players, setPlayers]           = useState([])
  const [editing, setEditing]           = useState(null)
  const [form, setForm]                 = useState(BLANK)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [orderChanged, setOrderChanged] = useState(false)
  const [savingOrder, setSavingOrder]   = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: tData }, { data: pData }] = await Promise.all([
      getDrillTemplates(), getPlayers(),
    ])
    setTemplates(tData || [])
    setPlayers(pData  || [])
    setLoading(false)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function startNew()   { setForm(BLANK); setEditing('new'); setError(null) }
  function startEdit(t) {
    setForm({
      ...t,
      goal_percent:   t.goal_percent   ?? '',
      total_attempts: t.total_attempts ?? '',
      required_makes: t.required_makes ?? '',
      drill_type:     t.drill_type     ?? 'attempt_count',
    })
    setEditing(t)
    setError(null)
  }

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      setTemplates(prev => {
        const oldIdx = prev.findIndex(t => t.id === active.id)
        const newIdx = prev.findIndex(t => t.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
      setOrderChanged(true)
    }
  }

  async function handleSaveOrder() {
    setSavingOrder(true)
    const ordered = templates.map((t, i) => ({ id: t.id, sort_order: i }))
    await saveDrillTemplateOrder(ordered)
    setSavingOrder(false)
    setOrderChanged(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (form.drill_type === 'attempt_count' && !form.total_attempts) {
      setError('Total attempts is required'); return
    }
    if (form.drill_type === 'make_count' && !form.required_makes) {
      setError('Required makes is required'); return
    }

    const payload = {
      name:            form.name.trim(),
      drill_type:      form.drill_type,
      total_attempts:  form.drill_type === 'attempt_count' ? parseInt(form.total_attempts) : null,
      required_makes:  form.drill_type === 'make_count'    ? parseInt(form.required_makes)  : null,
      contested:       form.contested,
      goal_percent:    form.goal_percent ? parseInt(form.goal_percent) : null,
      is_global:       form.is_global,
      owner_player_id: form.is_global ? null : (form.owner_player_id || null),
    }

    if (editing === 'new') {
      const { data, error: e } = await createDrillTemplate(payload)
      if (e) { setError(e.message); return }
      setTemplates(prev => [...prev, data])
    } else {
      const { data, error: e } = await updateDrillTemplate(editing.id, payload)
      if (e) { setError(e.message); return }
      setTemplates(prev => prev.map(t => t.id === data.id ? data : t))
    }
    setEditing(null)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this drill template? This cannot be undone.')) return
    const { error: e } = await deleteDrillTemplate(id)
    if (e) { alert('Error: ' + e.message); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
    setOrderChanged(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate('/basketball')} className="text-gray-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">Drill Templates</h1>
          <div className="flex gap-2">
            {orderChanged && (
              <button onClick={handleSaveOrder} disabled={savingOrder}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                <Check size={14} /> {savingOrder ? 'Saving...' : 'Save Order'}
              </button>
            )}
            {!editing && (
              <button onClick={startNew}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm font-medium">
                <Plus size={16} /> New
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {editing && (
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-500 space-y-3">
            <h2 className="text-sm font-medium text-orange-400">
              {editing === 'new' ? 'New Drill Template' : `Edit: ${editing.name}`}
            </h2>
            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div>
              <label className="text-xs text-gray-400 block mb-1">Drill Name *</label>
              <input type="text" value={form.name}
                placeholder="e.g. 5 spots x 4 rounds (100 shots)"
                onChange={e => setField('name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>

            {/* Drill type toggle */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Drill Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setField('drill_type', 'attempt_count')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.drill_type === 'attempt_count' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300'
                  }`}>
                  Fixed Attempts
                </button>
                <button
                  onClick={() => setField('drill_type', 'make_count')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.drill_type === 'make_count' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
                  }`}>
                  Make Count
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                {form.drill_type === 'attempt_count'
                  ? 'Track makes out of a fixed number of attempts — e.g. 78/100'
                  : 'Track attempts needed to reach a target makes — e.g. Lift & Drift (make 2 at 10 spots)'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {form.drill_type === 'attempt_count' ? (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Total Attempts *</label>
                  <input type="number" min="1" value={form.total_attempts} placeholder="100"
                    onChange={e => setField('total_attempts', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Required Makes *</label>
                  <input type="number" min="1" value={form.required_makes} placeholder="20"
                    onChange={e => setField('required_makes', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Goal %</label>
                <input type="number" min="0" max="100" value={form.goal_percent} placeholder="80"
                  onChange={e => setField('goal_percent', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.contested}
                  onChange={e => setField('contested', e.target.checked)}
                  className="accent-orange-500 w-4 h-4" />
                Contested
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.is_global}
                  onChange={e => setField('is_global', e.target.checked)}
                  className="accent-orange-500 w-4 h-4" />
                Global (all players)
              </label>
            </div>

            {!form.is_global && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Assign to Player</label>
                <select value={form.owner_player_id || ''}
                  onChange={e => setField('owner_player_id', e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Select player</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium">
                Save Template
              </button>
              <button onClick={() => setEditing(null)}
                className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {templates.length > 1 && !editing && (
          <p className="text-xs text-gray-600 text-center">⠿ Drag to reorder · tap Save Order when done</p>
        )}

        {templates.length === 0 && !editing ? (
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center text-gray-500 text-sm">
            No templates yet. Tap New to add your first drill.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {templates.map(t => (
                  <SortableTemplateRow key={t.id} template={t} onEdit={startEdit} onDelete={handleDelete} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}