import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
})

export default function Login() {
  const navigate = useNavigate()
  const { login, role } = useAuthStore()
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password)
      const currentRole = useAuthStore.getState().role
      if (currentRole) {
        navigate(`/${currentRole}/dashboard`)
      }
    } catch (error) {
      setError("root", { message: "Login gagal. Periksa kembali email dan password Anda." })
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* Background modern abstract decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-600/20 to-emerald-600/20 blur-[120px] pointer-events-none" />
      
      {/* Subtle Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border border-slate-800 bg-slate-900/75 backdrop-blur-xl shadow-2xl text-slate-100 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/80">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          
          <CardHeader className="space-y-2 flex flex-col items-center pt-8 pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-indigo-500/25 ring-2 ring-white/10 transform transition-transform hover:scale-105 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v7" />
              </svg>
            </div>
            <CardTitle className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight text-center">
              Ekskul JHS GM
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm text-center max-w-[280px]">
              Aplikasi Layanan Kegiatan Ekstrakurikuler Junior High School
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@sekolah.com"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl h-11"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p className="text-xs text-rose-400 font-medium mt-1">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl h-11"
                    {...register("password")}
                  />
                </div>
                {errors.password && <p className="text-xs text-rose-400 font-medium mt-1">{errors.password.message}</p>}
              </div>

              {errors.root && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                  {errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl h-11 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-[0.98] transition-all duration-200" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  "Masuk ke Akun"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t border-slate-800/60 bg-slate-950/40 py-4 px-8 text-center">
            <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
              Aplikasi Ekskul JHS GM
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Pembuat: Jalian Pebriandy 2026
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
