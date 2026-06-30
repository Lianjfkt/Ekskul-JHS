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

  const toTitleCase = (str) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const onSubmit = async (data) => {
    try {
      const cleanEmail = data.email.toLowerCase().trim()
      const cleanName = toTitleCase(data.full_name.trim())
      const cleanClass = data.class.trim()

      // 1. Panggil fungsi RPC untuk registrasi terpadu
      const { error: regError } = await supabase.rpc('student_self_register', {
        p_email: cleanEmail,
        p_password: data.password,
        p_nis: data.nis.trim(),
        p_full_name: cleanName,
        p_class: cleanClass,
        p_gender: data.gender,
        p_phone: data.phone.trim()
      })

      if (regError) throw regError

      // 2. Login otomatis setelah berhasil registrasi
      await login(cleanEmail, data.password)
      
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
    <div className="relative flex min-h-screen items-center justify-center bg-pixel-navy pixel-bg-dots overflow-y-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Pixel art decorative stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-pixel-white/30"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Pixel grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(95,87,79,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(95,87,79,0.08)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl my-6">
        <Card className="border-4 border-pixel-gray bg-pixel-panel overflow-hidden">
          {/* Top pixel accent bar */}
          <div className="h-2 bg-pixel-green" />
          
          <CardHeader className="space-y-3 flex flex-col items-center pt-8 pb-4 border-b-4 border-pixel-gray">
            {/* Pixel art icon */}
            <div className="w-16 h-16 bg-pixel-green border-4 border-pixel-gray flex items-center justify-center shadow-pixel">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pixel-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <CardTitle className="text-sm font-pixel text-pixel-green pixel-text-shadow text-center leading-loose">
              Registrasi Siswa
            </CardTitle>
            <CardDescription className="text-pixel-lavender font-retro text-xl text-center">
              Lengkapi data diri untuk mendaftar ke sistem ekstrakurikuler
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* NIS & Full Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nis" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">NIS</Label>
                  <Input
                    id="nis"
                    placeholder="Contoh: 202601001"
                    {...register("nis")}
                  />
                  <p className="font-retro text-base text-pixel-lavender/60">Contoh: 202601001</p>
                  {errors.nis && <p className="font-retro text-base text-pixel-red mt-1">! {errors.nis.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    placeholder="Contoh: Budi Santoso"
                    {...register("full_name")}
                  />
                  <p className="font-retro text-base text-pixel-lavender/60">Huruf awal kapital</p>
                  {errors.full_name && <p className="font-retro text-base text-pixel-red mt-1">! {errors.full_name.message}</p>}
                </div>
              </div>

              {/* Class & Gender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Kelas</Label>
                  <Input
                    id="class"
                    placeholder="Contoh: 7.1"
                    {...register("class")}
                  />
                  <p className="font-retro text-base text-pixel-lavender/60">Format: 7.1 atau 8.2</p>
                  {errors.class && <p className="font-retro text-base text-pixel-red mt-1">! {errors.class.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Gender</Label>
                  <select
                    id="gender"
                    className="pixel-input flex h-10 w-full rounded-none px-3 py-2 font-retro text-lg"
                    {...register("gender")}
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                  <p className="font-retro text-base text-pixel-lavender/60">Pilih jenis kelamin</p>
                  {errors.gender && <p className="font-retro text-base text-pixel-red mt-1">! {errors.gender.message}</p>}
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">No. Telepon</Label>
                  <Input
                    id="phone"
                    placeholder="Contoh: 081234567890"
                    {...register("phone")}
                  />
                  <p className="font-retro text-base text-pixel-lavender/60">Awali dengan 0</p>
                  {errors.phone && <p className="font-retro text-base text-pixel-red mt-1">! {errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Email Login</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@jhs.com"
                    {...register("email")}
                  />
                  <p className="font-retro text-base text-pixel-lavender/60">Format: user@jhs.com</p>
                  {errors.email && <p className="font-retro text-base text-pixel-red mt-1">! {errors.email.message}</p>}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Password Akun</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 karakter"
                  {...register("password")}
                />
                <p className="font-retro text-base text-pixel-lavender/60">Password minimal 6 karakter</p>
                {errors.password && <p className="font-retro text-base text-pixel-red mt-1">! {errors.password.message}</p>}
              </div>

              {errors.root && (
                <div className="p-3 bg-pixel-red/10 border-3 border-pixel-red text-pixel-red font-retro text-lg text-center">
                  {errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-pixel-green text-pixel-navy font-pixel text-[10px] h-12 shadow-pixel hover:brightness-110" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="pixel-blink">LOADING...</span>
                  </span>
                ) : (
                  "DAFTAR AKUN BARU"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t-4 border-pixel-gray bg-pixel-navy/50 py-4 px-8 text-center">
            <p className="font-retro text-lg text-pixel-lavender">
              Sudah memiliki akun? <Link to="/auth/login" className="text-pixel-blue hover:text-pixel-yellow font-bold">Masuk di sini</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
