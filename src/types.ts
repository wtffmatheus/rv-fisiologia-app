export type Profile = {
  id: string
  name: string
  email: string
  role: 'student' | 'admin'
  status: 'pending' | 'active' | 'blocked'
  created_at: string
  language: 'pt-BR' | 'en' | 'es' | 'zh-CN' | 'de'
}
