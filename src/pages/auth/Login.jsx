import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate, Link } from 'react-router-dom'
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
    <div className="relative flex min-h-screen items-center justify-center bg-pixel-navy pixel-bg-dots overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* Pixel art decorative stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-pixel-white/30"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Pixel grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(95,87,79,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(95,87,79,0.08)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border-4 border-pixel-gray bg-pixel-panel overflow-hidden">
          {/* Top pixel accent bar */}
          <div className="h-2 bg-pixel-blue" />
          
          <CardHeader className="space-y-3 flex flex-col items-center pt-8 pb-4 border-b-4 border-pixel-gray">
            {/* Pixel art icon */}
            <div className="w-16 h-16 bg-pixel-blue border-4 border-pixel-gray flex items-center justify-center shadow-pixel">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pixel-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0v7" />
              </svg>
            </div>
            <CardTitle className="text-sm font-pixel text-pixel-blue pixel-text-shadow text-center leading-loose">
              Ekskul JHS GM
            </CardTitle>
            <CardDescription className="text-pixel-lavender font-retro text-xl text-center">
              Aplikasi Layanan Kegiatan Ekstrakurikuler Junior High School
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@sekolah.com"
                  {...register("email")}
                />
                {errors.email && <p className="font-retro text-base text-pixel-red mt-1">! {errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && <p className="font-retro text-base text-pixel-red mt-1">! {errors.password.message}</p>}
              </div>

              {errors.root && (
                <div className="p-3 bg-pixel-red/10 border-3 border-pixel-red text-pixel-red font-retro text-lg text-center">
                  {errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-pixel-blue text-pixel-navy font-pixel text-[10px] h-12 shadow-pixel hover:brightness-110" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="pixel-blink">LOADING...</span>
                  </span>
                ) : (
                  "MASUK"
                )}
              </Button>
              <div className="text-center font-retro text-lg text-pixel-lavender mt-4">
                Belum punya akun? <Link to="/auth/register" className="text-pixel-green hover:text-pixel-yellow font-bold">Daftar sebagai Siswa</Link>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t-4 border-pixel-gray bg-pixel-navy/50 py-4 px-8 text-center">
            <p className="font-pixel text-[7px] text-pixel-lavender tracking-widest uppercase">
              Aplikasi Ekskul JHS GM
            </p>
            <p className="font-retro text-base text-pixel-lavender/60 mt-1">
              Pembuat: Jalian Pebriandy 2026
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
