import { z } from 'zod';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少 6 个字符'),
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
