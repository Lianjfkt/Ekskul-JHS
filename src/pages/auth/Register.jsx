import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const registerSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
  nis: z.string().min(3, { message: "NIS minimal 3 karakter" }),
  full_name: z.string().min(3, { message: "Nama Lengkap minimal 3 karakter" }),
  class: z.string().min(2, { message: "Kelas minimal 2 karakter (contoh: VII-A)" }),
  gender: z.enum(['Laki-laki', 'Perempuan'], { errorMap: () => ({ message: "Jenis kelamin tidak valid" }) }),
  phone: z.string().min(10, { message: "Nomor telepon minimal 10 digit" })
})

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      gender: 'Laki-laki'
    }
  })

  const onSubmit = async (data) => {
    try {
      // 1. Panggil fungsi RPC untuk registrasi terpadu
      const { error: regError } = await supabase.rpc('student_self_register', {
        p_email: data.email,
        p_password: data.password,
        p_nis: data.nis,
        p_full_name: data.full_name,
        p_class: data.class,
        p_gender: data.gender,
        p_phone: data.phone
      })

      if (regError) throw regError

      // 2. Login otomatis setelah berhasil registrasi
      await login(data.email, data.password)
      
      const currentRole = useAuthStore.getState().role
      if (currentRole) {
        navigate(`/${currentRole}/dashboard`)
      }
    } catch (error) {
      console.error(error)
      setError("root", { 
        message: error.message || "Pendaftaran gagal. Pastikan NIS atau Email belum digunakan." 
      })
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 overflow-y-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-600/20 to-emerald-600/20 blur-[120px] pointer-events-none" />
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl my-6">
        <Card className="border border-slate-800 bg-slate-900/75 backdrop-blur-xl shadow-2xl text-slate-100 rounded-2xl overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          
          <CardHeader className="space-y-2 flex flex-col items-center pt-8 pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-indigo-500/25 transform transition-transform hover:scale-105 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <CardTitle className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight text-center">
              Registrasi Siswa Baru
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm text-center">
              Lengkapi data diri Anda untuk mendaftar ke sistem ekstrakurikuler
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* NIS & Full Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nis" className="text-xs font-semibold uppercase tracking-wider text-slate-400">NIS</Label>
                  <Input
                    id="nis"
                    placeholder="Contoh: 202601001"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                    {...register("nis")}
                  />
                  {errors.nis && <p className="text-xs text-rose-400 font-medium mt-1">{errors.nis.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    placeholder="Contoh: Budi Santoso"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                    {...register("full_name")}
                  />
                  {errors.full_name && <p className="text-xs text-rose-400 font-medium mt-1">{errors.full_name.message}</p>}
                </div>
              </div>

              {/* Class & Gender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kelas</Label>
                  <Input
                    id="class"
                    placeholder="Contoh: VIII-A"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                    {...register("class")}
                  />
                  {errors.class && <p className="text-xs text-rose-400 font-medium mt-1">{errors.class.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gender</Label>
                  <select
                    id="gender"
                    className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    {...register("gender")}
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                  {errors.gender && <p className="text-xs text-rose-400 font-medium mt-1">{errors.gender.message}</p>}
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-400">No. Telepon / WhatsApp</Label>
                  <Input
                    id="phone"
                    placeholder="Contoh: 081234567890"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                    {...register("phone")}
                  />
                  {errors.phone && <p className="text-xs text-rose-400 font-medium mt-1">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Login</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="siswa@sekolah.com"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                    {...register("email")}
                  />
                  {errors.email && <p className="text-xs text-rose-400 font-medium mt-1">{errors.email.message}</p>}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password Akun</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 karakter"
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl"
                  {...register("password")}
                />
                {errors.password && <p className="text-xs text-rose-400 font-medium mt-1">{errors.password.message}</p>}
              </div>

              {errors.root && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                  {errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl h-11 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all duration-200" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mendaftarkan...
                  </span>
                ) : (
                  "Daftar Akun Baru"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t border-slate-800/60 bg-slate-950/40 py-4 px-8 text-center">
            <p className="text-sm text-slate-400">
              Sudah memiliki akun? <Link to="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">Masuk di sini</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
