export type Role = 'requester' | 'agent' | 'admin'

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export type TicketStatus = 'open' | 'in_progress' | 'closed'

export interface User {
  id: number
  username: string
  email: string
  role: Role
  is_active: boolean
}

export interface Ticket {
  id: number
  title: string
  description: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  due_date: string | null
  assignee_id: number | null
  requester_id: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: number
  ticket_id: number
  author_id: number
  body: string
  created_at: string
}

export interface AuditLog {
  id: number
  ticket_id: number
  user_id: number
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface TicketDetail extends Ticket {
  comments: Comment[]
  audit_log: AuditLog[]
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface TicketListResponse {
  items: Ticket[]
  total: number
  page: number
  page_size: number
}

export interface DashboardStats {
  open: number
  overdue: number
  closed_today: number
  by_priority: {
    low: number
    medium: number
    high: number
    critical: number
  }
}
