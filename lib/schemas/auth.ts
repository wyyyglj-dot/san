import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, '请填写用户名'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
  verificationCode: z.string().optional(),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
