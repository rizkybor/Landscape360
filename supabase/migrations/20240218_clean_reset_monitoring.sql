-- 1. Hapus profil monitoring@landscape360.app jika ada (karena ini mungkin orphan/yatim tanpa auth user)
DELETE FROM public.profiles WHERE email = 'monitoring@landscape360.app';

-- 2. Hapus juga auth user jika ada (untuk clean slate)
DELETE FROM auth.users WHERE email = 'monitoring@landscape360.app';
