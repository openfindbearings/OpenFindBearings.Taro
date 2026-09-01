import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Package } from 'lucide-react-taro'
import { updateMerchantProfile, getMyBearings, type MyMerchantProfile, type MerchantBearingItem } from '../../../services/merchantManage'
import EmptyState from '../../../components/EmptyState'
import { useEffect } from 'react'

/** 已入驻管理面板 */
export default function ManagePanel({ profile, onUpdate }: { profile: MyMerchantProfile; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [contact, setContact] = useState(profile.contact || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [description, setDescription] = useState(profile.description || '')
  const [bearings, setBearings] = useState<MerchantBearingItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMyBearings(1, 50)
      .then((res) => setBearings(res.items))
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMerchantProfile({ name, contact, phone, description })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setEditing(false)
      onUpdate()
    } catch (e: unknown) {
      Taro.showToast({ title: (e as Error).message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='manage-panel'>
      {/* 店铺信息 */}
      <View className='manage-section'>
        <View className='manage-section__header'>
          <Text className='manage-section__title'>店铺信息</Text>
          <Text className='manage-section__action' onClick={() => setEditing(!editing)}>
            {editing ? '取消' : '编辑'}
          </Text>
        </View>

        {editing ? (
          <View className='manage-form'>
            <View className='form-field'>
              <Text className='form-field__label'>店铺名称</Text>
              <Input className='form-field__input' value={name} onInput={(e) => setName(e.detail.value)} />
            </View>
            <View className='form-field'>
              <Text className='form-field__label'>联系人</Text>
              <Input className='form-field__input' value={contact} onInput={(e) => setContact(e.detail.value)} />
            </View>
            <View className='form-field'>
              <Text className='form-field__label'>联系电话</Text>
              <Input className='form-field__input' value={phone} onInput={(e) => setPhone(e.detail.value)} />
            </View>
            <View className='form-field'>
              <Text className='form-field__label'>店铺简介</Text>
              <Textarea className='form-field__textarea' value={description} onInput={(e) => setDescription(e.detail.value)} />
            </View>
            <Button className='manage-form__save' onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </View>
        ) : (
          <View className='manage-info'>
            <View className='manage-info__row'>
              <Text className='manage-info__label'>店铺名称</Text>
              <Text className='manage-info__value'>{profile.name}</Text>
            </View>
            <View className='manage-info__row'>
              <Text className='manage-info__label'>联系人</Text>
              <Text className='manage-info__value'>{profile.contact || '-'}</Text>
            </View>
            <View className='manage-info__row'>
              <Text className='manage-info__label'>联系电话</Text>
              <Text className='manage-info__value'>{profile.phone || '-'}</Text>
            </View>
            <View className='manage-info__row'>
              <Text className='manage-info__label'>认证状态</Text>
              <Text className={`manage-info__value ${profile.isVerified ? 'text-success' : ''}`}>
                {profile.isVerified ? '已认证' : '未认证'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 在售商品 */}
      <View className='manage-section'>
        <View className='manage-section__header'>
          <Text className='manage-section__title'>在售商品 ({bearings.length})</Text>
        </View>
        {bearings.length === 0 ? (
          <EmptyState text='暂无在售商品' icon={Package} />
        ) : (
          <View className='bearing-list'>
            {bearings.map((b) => (
              <View key={b.id} className='bearing-list__item'>
                <View className='bearing-list__info'>
                  <Text className='bearing-list__model'>{b.bearingPartNumber}</Text>
                  <Text className='bearing-list__brand'>{b.brandName || ''}</Text>
                </View>
                <Text className={`bearing-list__status ${b.isOnSale ? 'on-sale' : 'off-sale'}`}>
                  {b.isOnSale ? '在售' : '下架'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
