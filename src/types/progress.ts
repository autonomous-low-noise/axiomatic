export interface BookProgress {
  currentPage: number
  totalPages: number
  lastReadAt: string
}

export type ProgressMap = Record<string, BookProgress>

export type BookStatus = 'open' | 'in-progress' | 'need-revisit' | 'done'
export type BookStatusMap = Record<string, BookStatus>
export type SnipStatus = 'open' | 'solid' | 'attention'
