import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Store } from 'lucide-react-taro'
import { applyMerchant } from '../../../services/merchantManage'

/** 入驻申请表单 */
export default function ApplyForm({ onSuccess }: { onSuccess: () => void }) {
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!contactName.trim()) {
      Taro.showToast({ title: '请输入联系人姓名', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await applyMerchant({ contactName: contactName.trim(), phone, description: description.trim() })
      Taro.showToast({ title: '申请已提交', icon: 'success' })
      onSuccess()
    } catch (e: unknown) {
      Taro.showToast({ title: (e as Error).message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='apply-form'>
      <View className='apply-form__header'>
        <View className='apply-form__icon'>
          <Store size={48} color='#1890ff' strokeWidth={1.5} />
        </View>
        <Text className='apply-form__title'>申请入驻</Text>
        <Text className='apply-form__desc'>成为认证商家，展示和销售您的轴承产品</Text>
      </View>

      <View className='apply-form__body'>
        <View className='form-field'>
          <Text className='form-field__label'>联系人姓名 *</Text>
          <Input
            className='form-field__input'
            placeholder='请输入联系人姓名'
            value={contactName}
            onInput={(e) => setContactName(e.detail.value)}
          />
        </View>

        <View className='form-field'>
          <Text className='form-field__label'>联系电话 *</Text>
          <Input
            className='form-field__input'
            placeholder='请输入手机号'
            type='number'
            maxlength={11}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>

        <View className='form-field'>
          <Text className='form-field__label'>店铺简介</Text>
          <Textarea
            className='form-field__textarea'
            placeholder='介绍一下您的店铺（选填）'
            value={description}
            onInput={(e) => setDescription(e.detail.value)}
          />
        </View>

        <Button
          className='apply-form__submit'
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '提交中...' : '提交申请'}
        </Button>
      </View>
    </View>
  )
}
