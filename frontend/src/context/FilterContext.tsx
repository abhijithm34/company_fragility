import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type FilterState = {
  minProbability: number
  riskCategories: string[]
  companies: string[]
  startQuarter: string
  endQuarter: string
}

type FilterContextType = {
  filters: FilterState
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>
  clearFilters: () => void
}

const defaultFilters: FilterState = {
  minProbability: 0,
  riskCategories: [],
  companies: [],
  startQuarter: '',
  endQuarter: '',
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const clearFilters = () => setFilters(defaultFilters)

  return (
    <FilterContext.Provider value={{ filters, setFilters, clearFilters }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider')
  }
  return context
}
