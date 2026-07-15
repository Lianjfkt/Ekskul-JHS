import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Lock, Save, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function Profile() {
  const { user, role } = useAuthStore()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      // Get detailed user data
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          students:student_id (nis, class)
        `)
        .eq('id', user.id)
        .single()
        
      if (error) throw error
      setUserData(data)
    } catch (err) {
      console.error('Error fetching profile:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setMsg({ type: '', text: '' })

    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Password minimal 6 karakter.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Konfirmasi password tidak cocok.' })
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      
      setMsg({ type: 'success', text: 'Password berhasil diperbarui!' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Gagal memperbarui password: ' + err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-pixel-navy p-6 rounded-none text-pixel-white shadow-pixel border border-pixel-gray/30">
        <h1 className="font-pixel text-[10px] text-pixel-peach uppercase tracking-wider pixel-text-shadow">
          Profil Pengguna
        </h1>
        <p className="font-retro text-base text-pixel-lavender mt-2">
          Kelola informasi akun dan keamanan Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Card */}
        <Card className="border-pixel-gray/30 bg-pixel-panel shadow-pixel-sm">
          <CardHeader className="border-b-2 border-pixel-gray/30 pb-4 bg-pixel-navy/20">
            <CardTitle className="font-pixel text-[10px] text-pixel-blue flex items-center gap-2">
              <User className="w-5 h-5" /> Informasi Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 font-retro text-lg">
            {loading ? (
              <div className="text-pixel-lavender animate-pulse">Memuat profil...</div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-pixel-lavender mb-1">Nama Lengkap</p>
                  <p className="text-pixel-white font-semibold">{userData?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-pixel-lavender mb-1">Email</p>
                  <p className="text-pixel-peach font-mono">{userData?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-pixel-lavender mb-1">Peran (Role)</p>
                  <span className="inline-block px-2 py-1 border border-pixel-gray bg-pixel-navy/50 text-pixel-lavender uppercase text-sm">
                    {userData?.role}
                  </span>
                </div>

                {userData?.students && (
                  <div className="pt-4 border-t border-pixel-gray/30 mt-4">
                    <p className="text-sm text-pixel-lavender mb-1">Data Siswa</p>
                    <p className="text-pixel-white">NIS: <span className="font-mono text-pixel-peach">{userData.students.nis}</span></p>
                    <p className="text-pixel-white">Kelas: <span className="text-pixel-blue">{userData.students.class}</span></p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="border-pixel-gray/30 bg-pixel-panel shadow-pixel-sm">
          <CardHeader className="border-b-2 border-pixel-gray/30 pb-4 bg-pixel-navy/20">
            <CardTitle className="font-pixel text-[10px] text-pixel-green flex items-center gap-2">
              <Lock className="w-5 h-5" /> Ganti Password
            </CardTitle>
            <CardDescription className="font-retro text-base text-pixel-lavender">
              Gunakan password yang kuat demi keamanan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {msg.text && (
              <div className={`p-3 mb-4 font-retro text-base flex items-start gap-2 border-2 ${
                msg.type === 'success' 
                  ? 'bg-pixel-green/10 border-pixel-green text-pixel-green' 
                  : 'bg-pixel-red/10 border-pixel-red text-pixel-red'
              }`}>
                {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />}
                {msg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Password Baru</Label>
                <Input
                  id="new_password"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-pixel-navy"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Konfirmasi Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-pixel-navy"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSaving || !newPassword}
                className="w-full gap-2 mt-2 bg-pixel-green text-pixel-navy hover:brightness-110"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Menyimpan...' : 'Perbarui Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
