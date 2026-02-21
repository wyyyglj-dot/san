'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Video,
  Check,
  X,
  Star,
  UsersRound,
  DollarSign,
} from 'lucide-react';
import { AdminPageLayout } from '@/components/admin/ui/admin-page-layout';
import { cn } from '@/lib/utils';
import type { SafeUserGroup, SafeUser, SafeVideoChannel } from '@/types';

export default function UserGroupsPage() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<SafeUserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<SafeUserGroup | null>(null);

  // 编辑状态
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // 成员管理
  const [members, setMembers] = useState<SafeUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // 渠道权限
  const [allChannels, setAllChannels] = useState<SafeVideoChannel[]>([]);
  const [groupChannelIds, setGroupChannelIds] = useState<string[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);

  // 定价管理
  const [pricings, setPricings] = useState<Array<{ id: string; modelId: string; modelType: string; customCost: number }>>([]);
  const [loadingPricings, setLoadingPricings] = useState(false);
  const [savingPricings, setSavingPricings] = useState(false);
  const [newPricingModelId, setNewPricingModelId] = useState('');
  const [newPricingModelType, setNewPricingModelType] = useState<'image' | 'video'>('image');
  const [newPricingCost, setNewPricingCost] = useState('');

  const isAdmin = session?.user?.role === 'admin';

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/user-groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.data || []);
      }
    } catch (err) {
      console.error('加载用户组失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (groupId: string) => {
    try {
      setLoadingMembers(true);
      const res = await fetch(`/api/admin/user-groups/${groupId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data || []);
      }
    } catch (err) {
      console.error('加载成员失败:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadChannels = useCallback(async (groupId: string) => {
    try {
      setLoadingChannels(true);
      const [channelsRes, permissionsRes] = await Promise.all([
        fetch('/api/admin/video-channels'),
        fetch(`/api/admin/user-groups/${groupId}/channels`),
      ]);

      if (channelsRes.ok) {
        const data = await channelsRes.json();
        setAllChannels(data.data || []);
      }

      if (permissionsRes.ok) {
        const data = await permissionsRes.json();
        setGroupChannelIds(data.data?.channelIds || []);
      }
    } catch (err) {
      console.error('加载渠道失败:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const loadPricings = useCallback(async (groupId: string) => {
    try {
      setLoadingPricings(true);
      const res = await fetch(`/api/admin/user-groups/${groupId}/pricing`);
      if (res.ok) {
        const data = await res.json();
        setPricings(data.data || []);
      }
    } catch (err) {
      console.error('加载定价失败:', err);
    } finally {
      setLoadingPricings(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id);
      loadChannels(selectedGroup.id);
      loadPricings(selectedGroup.id);
    } else {
      setMembers([]);
      setGroupChannelIds([]);
      setPricings([]);
    }
  }, [selectedGroup, loadMembers, loadChannels, loadPricings]);

  const selectGroup = (group: SafeUserGroup) => {
    setSelectedGroup(group);
    setEditMode(null);
  };

  const startCreate = () => {
    setEditMode('create');
    setEditName('');
    setEditDescription('');
    setEditIsDefault(false);
    setSelectedGroup(null);
  };

  const startEdit = () => {
    if (!selectedGroup) return;
    setEditMode('edit');
    setEditName(selectedGroup.name);
    setEditDescription(selectedGroup.description);
    setEditIsDefault(selectedGroup.isDefault);
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditName('');
    setEditDescription('');
    setEditIsDefault(false);
  };

  const saveGroup = async () => {
    if (!editName.trim()) {
      alert('请输入用户组名称');
      return;
    }

    try {
      setSaving(true);
      const url = '/api/admin/user-groups';
      const method = editMode === 'create' ? 'POST' : 'PUT';
      const body = editMode === 'create'
        ? { name: editName, description: editDescription, isDefault: editIsDefault }
        : { id: selectedGroup?.id, name: editName, description: editDescription, isDefault: editIsDefault };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await loadGroups();
        cancelEdit();
        if (editMode === 'edit' && selectedGroup) {
          const data = await res.json();
          setSelectedGroup(data.data);
        }
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!selectedGroup) return;
    if (!confirm(`确定要删除用户组 "${selectedGroup.name}" 吗？此操作不可恢复。`)) return;

    try {
      const res = await fetch(`/api/admin/user-groups?id=${selectedGroup.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSelectedGroup(null);
        await loadGroups();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败');
    }
  };

  const toggleChannel = (channelId: string) => {
    setGroupChannelIds(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const saveChannelPermissions = async () => {
    if (!selectedGroup) return;

    try {
      setSavingChannels(true);
      const res = await fetch(`/api/admin/user-groups/${selectedGroup.id}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: groupChannelIds }),
      });

      if (res.ok) {
        await loadGroups();
        alert('保存成功');
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败');
    } finally {
      setSavingChannels(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedGroup) return;
    if (!confirm('确定要将此用户从用户组中移除吗？')) return;

    try {
      const res = await fetch(
        `/api/admin/user-groups/${selectedGroup.id}/members?userId=${userId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        await loadMembers(selectedGroup.id);
        await loadGroups();
      } else {
        const data = await res.json();
        alert(data.error || '移除失败');
      }
    } catch (err) {
      console.error('移除失败:', err);
      alert('移除失败');
    }
  };

  const addPricing = async () => {
    if (!selectedGroup || !newPricingModelId.trim() || !newPricingCost.trim()) return;
    const cost = parseFloat(newPricingCost);
    if (isNaN(cost) || cost < 0) { alert('请输入有效的价格'); return; }

    try {
      setSavingPricings(true);
      const res = await fetch(`/api/admin/user-groups/${selectedGroup.id}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricings: [{ modelId: newPricingModelId.trim(), modelType: newPricingModelType, customCost: cost }],
        }),
      });
      if (res.ok) {
        await loadPricings(selectedGroup.id);
        setNewPricingModelId('');
        setNewPricingCost('');
      } else {
        const data = await res.json();
        alert(data.error || '添加失败');
      }
    } catch (err) {
      console.error('添加定价失败:', err);
      alert('添加失败');
    } finally {
      setSavingPricings(false);
    }
  };

  const deletePricing = async (modelId: string) => {
    if (!selectedGroup) return;
    if (!confirm('确定要删除此定价覆盖吗？')) return;

    try {
      const res = await fetch(
        `/api/admin/user-groups/${selectedGroup.id}/pricing?modelId=${modelId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        await loadPricings(selectedGroup.id);
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      console.error('删除定价失败:', err);
      alert('删除失败');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-foreground/40">无权限访问此页面</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          <p className="text-sm text-foreground/40">加载用户组数据...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="用户组管理"
      description="管理用户组和渠道访问权限"
      icon={UsersRound}
      rightElement={
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建用户组
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* 用户组列表 */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0">
            {groups.map(group => (
              <div
                key={group.id}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all duration-200',
                  selectedGroup?.id === group.id
                    ? 'bg-card/50 border-white/[0.06] shadow-lg'
                    : 'bg-card/40 border-white/[0.06] hover:bg-card/50 hover:border-white/[0.06]'
                )}
                onClick={() => selectGroup(group)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/[0.06]">
                    <Users className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{group.name}</p>
                      {group.isDefault && (
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-foreground/40 truncate">
                      {group.memberCount} 成员 · {group.channelCount} 渠道
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {groups.length === 0 && (
              <div className="text-center py-8 text-foreground/40">
                暂无用户组，点击上方按钮创建
              </div>
            )}
          </div>
        </div>

        {/* 用户组详情 */}
        <div className="lg:col-span-2 overflow-y-auto space-y-4">
          {editMode ? (
            /* 编辑/创建表单 */
            <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                {editMode === 'create' ? '新建用户组' : '编辑用户组'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">
                    用户组名称 *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="输入用户组名称"
                    className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-white/[0.06] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">
                    描述
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="输入用户组描述"
                    rows={3}
                    className="w-full px-4 py-3 bg-card/40 border border-white/[0.06] rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-white/[0.06] transition-all resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={editIsDefault}
                    onChange={e => setEditIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-white/[0.06]"
                  />
                  <label htmlFor="isDefault" className="text-sm text-foreground/70">
                    设为默认用户组（新注册用户自动加入）
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveGroup}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  保存
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>
            </div>
          ) : selectedGroup ? (
            <>
              {/* 基本信息 */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{selectedGroup.name}</span>
                        {selectedGroup.isDefault && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            默认组
                          </span>
                        )}
                      </div>
                      {selectedGroup.description && (
                        <p className="text-sm text-foreground/50">{selectedGroup.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-card/40 border border-white/[0.06] text-foreground rounded-xl text-sm font-medium hover:bg-card/50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      编辑
                    </button>
                    <button
                      onClick={deleteGroup}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 border border-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">成员数</p>
                    <p className="text-foreground font-medium">{selectedGroup.memberCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-foreground/40 uppercase tracking-wider">可见渠道数</p>
                    <p className="text-foreground font-medium">{selectedGroup.channelCount}</p>
                  </div>
                </div>
              </div>

              {/* 渠道权限 */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Video className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-semibold text-foreground">可见视频渠道</span>
                  </div>
                  <button
                    onClick={saveChannelPermissions}
                    disabled={savingChannels}
                    className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                  >
                    {savingChannels ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    保存权限
                  </button>
                </div>
                <div className="p-5">
                  {loadingChannels ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
                    </div>
                  ) : allChannels.length === 0 ? (
                    <p className="text-center py-8 text-foreground/40">暂无视频渠道</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {allChannels.map(channel => (
                        <div
                          key={channel.id}
                          onClick={() => toggleChannel(channel.id)}
                          className={cn(
                            'p-3 rounded-xl border cursor-pointer transition-all',
                            groupChannelIds.includes(channel.id)
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'bg-card/40 border-white/[0.06] hover:bg-card/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                              groupChannelIds.includes(channel.id)
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-white/[0.06]'
                            )}>
                              {groupChannelIds.includes(channel.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">{channel.name}</p>
                              <p className="text-xs text-foreground/40">{channel.type}</p>
                            </div>
                            {!channel.enabled && (
                              <span className="text-xs text-red-400">已禁用</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 定价管理 */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="font-semibold text-foreground">模型定价覆盖</span>
                </div>
                <div className="p-5">
                  {loadingPricings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
                    </div>
                  ) : (
                    <>
                      {pricings.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {pricings.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-card/40 border border-white/[0.06]">
                              <div>
                                <p className="text-sm font-medium text-foreground">{p.modelId}</p>
                                <p className="text-xs text-foreground/40">{p.modelType === 'image' ? '图片' : '视频'} · 自定义价格: {p.customCost} 积分</p>
                              </div>
                              <button
                                onClick={() => deletePricing(p.modelId)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-foreground/40 mb-1">模型 ID</label>
                          <input
                            type="text"
                            value={newPricingModelId}
                            onChange={e => setNewPricingModelId(e.target.value)}
                            placeholder="输入模型 ID"
                            className="w-full px-3 py-2 bg-card/40 border border-white/[0.06] rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-foreground/40 mb-1">类型</label>
                          <select
                            value={newPricingModelType}
                            onChange={e => setNewPricingModelType(e.target.value as 'image' | 'video')}
                            className="w-full px-3 py-2 bg-card/40 border border-white/[0.06] rounded-lg text-sm text-foreground focus:outline-none"
                          >
                            <option value="image">图片</option>
                            <option value="video">视频</option>
                          </select>
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-foreground/40 mb-1">价格(积分)</label>
                          <input
                            type="number"
                            value={newPricingCost}
                            onChange={e => setNewPricingCost(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 bg-card/40 border border-white/[0.06] rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={addPricing}
                          disabled={savingPricings || !newPricingModelId.trim() || !newPricingCost.trim()}
                          className="flex items-center gap-1 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                        >
                          {savingPricings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          添加
                        </button>
                      </div>
                      <p className="text-xs text-foreground/30 mt-3">
                        为此用户组设置模型的自定义价格。用户属于多个组时取最低价。
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 成员列表 */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="font-semibold text-foreground">成员列表</span>
                </div>
                <div className="p-5">
                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-center py-8 text-foreground/40">暂无成员</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {members.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-card/40 border border-white/[0.06]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500/20 to-emerald-500/20 flex items-center justify-center border border-white/[0.06]">
                              <span className="text-foreground font-medium text-sm">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{member.name}</p>
                              <p className="text-xs text-foreground/40">{member.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeMember(member.id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-foreground/30 mt-3">
                    提示：在用户管理页面可以将用户添加到用户组
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card/40 flex items-center justify-center">
                <Users className="w-8 h-8 text-foreground/30" />
              </div>
              <p className="text-foreground/40">选择一个用户组查看详情</p>
            </div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
