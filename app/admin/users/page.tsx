'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Users, User, Ban, Check, Search, Edit2, Key, Coins, Loader2, ShieldAlert, Activity, UsersRound } from 'lucide-react';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import type { SafeUser, SafeUserGroup } from '@/types';
import { formatBalance, formatDate, cn } from '@/lib/utils';

const USERS_PAGE_SIZE = 50;

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<(SafeUser & { groupIds?: string[] }) | null>(null);
  const [editMode, setEditMode] = useState<'password' | 'balance' | 'concurrency' | 'groups' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');

  // 用户组相关状态
  const [allGroups, setAllGroups] = useState<SafeUserGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 当前用户是否是超级管理员
  const isAdmin = session?.user?.role === 'admin';
  // 当前用户是否是小管理员
  const isModerator = session?.user?.role === 'moderator';

  // 检查是否可以编辑目标用户（moderator 不能编辑 admin/moderator）
  const canEditUser = (targetUser: SafeUser | null) => {
    if (!targetUser) return false;
    if (isAdmin) return true;
    if (isModerator) {
      return targetUser.role !== 'admin' && targetUser.role !== 'moderator';
    }
    return false;
  };

  // 加载所有用户组
  const loadAllGroups = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingGroups(true);
      const res = await fetch('/api/admin/user-groups');
      if (res.ok) {
        const data = await res.json();
        setAllGroups(data.data || []);
      }
    } catch (err) {
      console.error('加载用户组失败:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAllGroups();
  }, [loadAllGroups]);

  const loadUsers = useCallback(async (nextPage = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', String(USERS_PAGE_SIZE));
      const term = search.trim();
      if (term) {
        params.set('q', term);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const nextUsers = data.data || [];
        setUsers((prev) => (append ? [...prev, ...nextUsers] : nextUsers));
        setPage(data.page || nextPage);
        setHasMore(Boolean(data.hasMore));
        if (!append) {
          setSelectedUser(null);
        }
      }
    } catch (err) {
      console.error('加载用户失败:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadUsers(1, false);
    }, 300);
    return () => clearTimeout(handle);
  }, [loadUsers]);

  const selectUser = async (user: SafeUser) => {
    setEditMode(null);
    // 获取用户详情（包含用户组信息）
    if (isAdmin) {
      try {
        const res = await fetch(`/api/admin/users/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedUser({ ...user, groupIds: data.user?.groupIds || [] });
          setSelectedGroupIds(data.user?.groupIds || []);
        } else {
          setSelectedUser(user);
          setSelectedGroupIds([]);
        }
      } catch {
        setSelectedUser(user);
        setSelectedGroupIds([]);
      }
    } else {
      setSelectedUser(user);
    }
  };

  const updateUser = async (updates: Record<string, unknown>) => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setSelectedUser({ ...selectedUser, ...updatedUser });
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updatedUser } : u));
        setEditMode(null);
        setEditValue('');
      }
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const toggleDisabled = () => {
    if (!selectedUser) return;
    updateUser({ disabled: !selectedUser.disabled });
  };

  const savePassword = () => {
    if (!editValue.trim() || editValue.length < 6) {
      alert('密码至少 6 个字符');
      return;
    }
    updateUser({ password: editValue });
  };

  const saveBalance = () => {
    const balance = parseInt(editValue);
    if (isNaN(balance) || balance < 0) {
      alert('请输入有效的积分数值');
      return;
    }
    updateUser({ balance });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          <p className="text-sm text-foreground/40">加载用户数据...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout title="用户管理" description="管理用户账号、余额和权限" icon={Users}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* 用户列表 */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="搜索用户..."
              className="w-full pl-11 pr-4 py-3 bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.06] focus:ring-2 focus:ring-ring/30 transition-all"
            />
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0">
            {users.map(user => (
              <div 
                key={user.id}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all duration-200',
                  selectedUser?.id === user.id 
                    ? 'bg-card/50 border-white/[0.06] shadow-lg' 
                    : 'bg-card/40 border-white/[0.06] hover:bg-card/50 hover:border-white/[0.06]',
                  user.disabled && 'opacity-50'
                )}
                onClick={() => selectUser(user)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 flex items-center justify-center border border-white/[0.06]">
                    <span className="text-foreground font-medium">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-sm text-foreground/40 truncate">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatBalance(user.balance)}</p>
                    {user.disabled && (
                      <span className="text-xs text-red-400">已禁用</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {hasMore && (
            <button
              onClick={() => loadUsers(page + 1, true)}
              disabled={loadingMore}
              className="w-full py-3 bg-card/40 border border-white/[0.06] text-foreground/60 rounded-xl text-sm font-medium hover:bg-card/50 hover:text-foreground disabled:opacity-50 transition-all"
            >
              {loadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载中...
                </span>
              ) : '加载更多'}
            </button>
          )}
        </div>

        {/* 用户详情 */}
        <div className="lg:col-span-2 overflow-y-auto">
          {selectedUser ? (
            <div className="space-y-4">
              {/* 无权限提示 */}
              {!canEditUser(selectedUser) && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-400">你没有权限修改此用户（管理员账号）</p>
                </div>
              )}

              {/* 基本信息 */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-semibold text-foreground">用户信息</span>
                  </div>
                  {canEditUser(selectedUser) && (
                    <button
                      onClick={toggleDisabled}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        selectedUser.disabled 
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                      )}
                    >
                      {selectedUser.disabled ? (
                        <><Check className="w-4 h-4" /> 启用账号</>
                      ) : (
                        <><Ban className="w-4 h-4" /> 禁用账号</>
                      )}
                    </button>
                  )}
                </div>
                <div className="p-5 grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">邮箱</p>
                    <p className="text-foreground font-medium">{selectedUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">昵称</p>
                    <p className="text-foreground font-medium">{selectedUser.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">角色</p>
                    <p className="text-foreground font-medium">
                      {selectedUser.role === 'admin' ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">超级管理员</span>
                      ) : selectedUser.role === 'moderator' ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">小管理员</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-card/50 text-foreground/60 border border-white/[0.06]">普通用户</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">注册时间</p>
                    <p className="text-foreground font-medium">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* 修改密码 - 仅有权限时显示 */}
              {canEditUser(selectedUser) && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Key className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="font-semibold text-foreground">修改密码</span>
                  </div>
                  <div className="p-5">
                    {editMode === 'password' ? (
                      <div className="flex gap-3">
                        <input
                          type="password"
                          value={editValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                          placeholder="输入新密码（至少6位）"
                          className="flex-1 px-4 py-3 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-white/[0.06] transition-all"
                        />
                        <button onClick={savePassword} className="px-5 py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors">保存</button>
                        <button onClick={() => { setEditMode(null); setEditValue(''); }} className="px-5 py-3 bg-card/50 text-foreground rounded-xl text-sm font-medium hover:bg-card/65 transition-colors">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditMode('password'); setEditValue(''); }} className="flex items-center gap-2 px-5 py-3 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-all">
                        <Edit2 className="w-4 h-4" />
                        重置密码
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 修改余额 - 仅有权限时显示 */}
              {canEditUser(selectedUser) && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">积分余额</span>
                      <p className="text-2xl font-bold text-green-400">{formatBalance(selectedUser.balance)}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    {editMode === 'balance' ? (
                      <div className="flex gap-3">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                          placeholder="输入新余额"
                          className="flex-1 px-4 py-3 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-white/[0.06] transition-all"
                        />
                        <button onClick={saveBalance} className="px-5 py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors">保存</button>
                        <button onClick={() => { setEditMode(null); setEditValue(''); }} className="px-5 py-3 bg-card/50 text-foreground rounded-xl text-sm font-medium hover:bg-card/65 transition-colors">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditMode('balance'); setEditValue(String(selectedUser.balance)); }} className="flex items-center gap-2 px-5 py-3 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-all">
                        <Edit2 className="w-4 h-4" />
                        修改余额
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 无权限时只显示余额（只读） */}
              {!canEditUser(selectedUser) && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">积分余额</span>
                      <p className="text-2xl font-bold text-green-400">{formatBalance(selectedUser.balance)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 并发限制配置 - 有编辑权限时可见 */}
              {canEditUser(selectedUser) && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">并发限制</span>
                      <p className="text-xs text-foreground/40 mt-1">
                        {selectedUser.concurrencyLimit === null ? '使用全局默认' : `最多 ${selectedUser.concurrencyLimit} 个并发任务`}
                      </p>
                    </div>
                  </div>
                  <div className="p-5">
                    {editMode === 'concurrency' ? (
                      <div className="flex gap-3">
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                          placeholder="留空使用全局默认"
                          className="flex-1 px-4 py-3 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-border"
                        />
                        <button onClick={() => updateUser({ concurrencyLimit: editValue === '' ? null : parseInt(editValue) })} className="px-5 py-3 bg-green-500/20 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-all">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditMode(null)} className="px-5 py-3 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-all">
                          取消
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditMode('concurrency'); setEditValue(selectedUser.concurrencyLimit === null ? '' : String(selectedUser.concurrencyLimit)); }} className="flex items-center gap-2 px-5 py-3 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-all">
                        <Edit2 className="w-4 h-4" />
                        修改限制
                      </button>
                    )}
                    <p className="text-xs text-foreground/30 mt-3">
                      设置为 0 表示不限制，留空使用全局默认值
                    </p>
                  </div>
                </div>
              )}

              {/* 修改角色 - 仅超级管理员可见，且不能修改自己和其他超级管理员 */}
              {isAdmin && selectedUser.role !== 'admin' && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5 text-sky-400" />
                    </div>
                    <span className="font-semibold text-foreground">用户角色</span>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-3">
                      <button
                        onClick={() => updateUser({ role: 'user' })}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border',
                          selectedUser.role === 'user'
                            ? 'bg-card/50 text-foreground border-white/[0.06]'
                            : 'bg-card/40 text-foreground/60 border-white/[0.06] hover:bg-card/50 hover:text-foreground'
                        )}
                      >
                        普通用户
                      </button>
                      <button
                        onClick={() => updateUser({ role: 'moderator' })}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border',
                          selectedUser.role === 'moderator'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : 'bg-card/40 text-foreground/60 border-white/[0.06] hover:bg-blue-500/10 hover:text-blue-400'
                        )}
                      >
                        小管理员
                      </button>
                    </div>
                    <p className="text-xs text-foreground/40 mt-3">
                      小管理员可以管理普通用户的积分、密码和禁用状态
                    </p>
                  </div>
                </div>
              )}

              {/* 用户组管理 - 仅超级管理员可见 */}
              {isAdmin && (
                <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <UsersRound className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">用户组</span>
                      <p className="text-xs text-foreground/40 mt-0.5">
                        {selectedGroupIds.length > 0
                          ? `已加入 ${selectedGroupIds.length} 个用户组`
                          : '未加入任何用户组'}
                      </p>
                    </div>
                  </div>
                  <div className="p-5">
                    {editMode === 'groups' ? (
                      <div className="space-y-3">
                        {loadingGroups ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-foreground/30" />
                          </div>
                        ) : allGroups.length === 0 ? (
                          <p className="text-center py-4 text-foreground/40">暂无用户组</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {allGroups.map(group => (
                              <div
                                key={group.id}
                                onClick={() => {
                                  setSelectedGroupIds(prev =>
                                    prev.includes(group.id)
                                      ? prev.filter(id => id !== group.id)
                                      : [...prev, group.id]
                                  );
                                }}
                                className={cn(
                                  'p-3 rounded-xl border cursor-pointer transition-all',
                                  selectedGroupIds.includes(group.id)
                                    ? 'bg-purple-500/10 border-purple-500/30'
                                    : 'bg-card/40 border-white/[0.06] hover:bg-card/50'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                    selectedGroupIds.includes(group.id)
                                      ? 'bg-purple-500 border-purple-500'
                                      : 'border-white/[0.06]'
                                  )}>
                                    {selectedGroupIds.includes(group.id) && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <span className="text-sm text-foreground truncate">{group.name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={async () => {
                              await updateUser({ groupIds: selectedGroupIds });
                              setEditMode(null);
                            }}
                            className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGroupIds(selectedUser?.groupIds || []);
                              setEditMode(null);
                            }}
                            className="px-5 py-2.5 bg-card/50 text-foreground rounded-xl text-sm font-medium hover:bg-card/65 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {selectedGroupIds.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {allGroups
                              .filter(g => selectedGroupIds.includes(g.id))
                              .map(group => (
                                <span
                                  key={group.id}
                                  className="px-3 py-1 text-sm rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                >
                                  {group.name}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground/40 mb-3">该用户未加入任何用户组</p>
                        )}
                        <button
                          onClick={() => setEditMode('groups')}
                          className="flex items-center gap-2 px-5 py-3 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                          管理用户组
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card/40 flex items-center justify-center">
                <User className="w-8 h-8 text-foreground/30" />
              </div>
              <p className="text-foreground/40">选择一个用户查看详情</p>
            </div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
