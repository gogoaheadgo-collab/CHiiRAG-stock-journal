import React, { useState, useMemo, useCallback } from 'react'
import ReactDOM from 'react-dom'

export function useTableFilter(data, columns, options = {}) {
  const { hasStatusFilter = false, statusField = 'status' } = options

  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortConfig, setSortConfig] = useState(null)
  const [columnFilters, setColumnFilters] = useState({})
  const [openFilterKey, setOpenFilterKey] = useState(null)
  const [filterDropPos, setFilterDropPos] = useState({ top: 0, left: 0 })

  const statusFiltered = useMemo(() => {
    if (!hasStatusFilter || statusFilter === 'ALL') return data
    return data.filter(row => {
      const val = typeof statusField === 'function' ? statusField(row) : row[statusField]
      return val?.toUpperCase() === statusFilter
    })
  }, [data, statusFilter, hasStatusFilter, statusField])

  const columnFiltered = useMemo(() => {
    let result = statusFiltered
    for (const [colKey, hiddenValues] of Object.entries(columnFilters)) {
      if (!hiddenValues || hiddenValues.size === 0) continue
      const col = columns.find(c => c.key === colKey)
      if (!col) continue
      result = result.filter(row => {
        const val = col.getValue ? col.getValue(row) : row[colKey]
        const displayVal = val != null ? String(val) : '(empty)'
        return !hiddenValues.has(displayVal)
      })
    }
    return result
  }, [statusFiltered, columnFilters, columns])

  const filteredData = useMemo(() => {
    if (!sortConfig) return columnFiltered
    const col = columns.find(c => c.key === sortConfig.key)
    if (!col) return columnFiltered
    return [...columnFiltered].sort((a, b) => {
      let aVal = col.getSortValue ? col.getSortValue(a) : (col.getValue ? col.getValue(a) : a[sortConfig.key])
      let bVal = col.getSortValue ? col.getSortValue(b) : (col.getValue ? col.getValue(b) : b[sortConfig.key])
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1
      if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [columnFiltered, sortConfig, columns])

  const getUniqueValues = useCallback((colKey) => {
    const col = columns.find(c => c.key === colKey)
    if (!col) return []
    const values = new Set()
    statusFiltered.forEach(row => {
      const val = col.getValue ? col.getValue(row) : row[colKey]
      values.add(val != null ? String(val) : '(empty)')
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }, [statusFiltered, columns])

  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      if (prev?.key === key) return prev.direction === 'asc' ? { key, direction: 'desc' } : null
      return { key, direction: 'asc' }
    })
  }, [])

  const openFilter = useCallback((e, colKey) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const dropWidth = 220
    const left = Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - dropWidth - 8)
    setFilterDropPos({ top: rect.bottom + 4, left })
    setOpenFilterKey(prev => prev === colKey ? null : colKey)
  }, [])

  const toggleFilterValue = useCallback((colKey, value) => {
    setColumnFilters(prev => {
      const current = new Set(prev[colKey] || [])
      if (current.has(value)) current.delete(value)
      else current.add(value)
      return { ...prev, [colKey]: current }
    })
  }, [])

  const selectAllFilter = useCallback((colKey) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: new Set() }))
  }, [])

  const deselectAllFilter = useCallback((colKey, allVals) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: new Set(allVals) }))
  }, [])

  const clearColumnFilter = useCallback((colKey) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n })
  }, [])

  const clearAllFilters = useCallback(() => {
    setColumnFilters({})
    setStatusFilter('ALL')
    setSortConfig(null)
  }, [])

  const activeFilterCount = useMemo(() =>
    Object.values(columnFilters).filter(s => s.size > 0).length + (statusFilter !== 'ALL' ? 1 : 0),
    [columnFilters, statusFilter])

  return {
    filteredData, sortConfig, columnFilters, statusFilter, setStatusFilter,
    openFilterKey, setOpenFilterKey, filterDropPos,
    openFilter, handleSort, toggleFilterValue, selectAllFilter, deselectAllFilter,
    clearColumnFilter, clearAllFilters, getUniqueValues, activeFilterCount, statusFiltered,
  }
}

export function FilterDropdown({ position, uniqueValues, hiddenValues, onToggle, onSelectAll, onDeselectAll, onClose }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : uniqueValues

  if (typeof document === 'undefined') return null

  return ReactDOM.createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div className="filter-dropdown"
        style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
        onClick={e => e.stopPropagation()}>
        <div className="filter-dropdown-header">
          <span>Filter</span>
          <div className="filter-dropdown-actions">
            <button onClick={onSelectAll}>All</button>
            <button onClick={onDeselectAll}>None</button>
          </div>
        </div>
        {uniqueValues.length > 8 && (
          <div className="filter-dropdown-search">
            <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        )}
        <div className="filter-dropdown-list">
          {filtered.map(val => (
            <div key={val} className="filter-dropdown-item" onClick={() => onToggle(val)}>
              <input type="checkbox" checked={!hiddenValues.has(val)} onChange={() => onToggle(val)} />
              <label>{val}</label>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>No matches</div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
