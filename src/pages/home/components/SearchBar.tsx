import { View, Text, Button } from '@tarojs/components'

/** 顶部搜索栏（独立组件，供首页引用） */
export default function SearchBar({
  searchType,
  keyword,
  onKeywordChange,
  onSearch,
  onTypeChange,
}: {
  searchType: 'bearing' | 'merchant'
  keyword: string
  onKeywordChange: (v: string) => void
  onSearch: () => void
  onTypeChange: (t: 'bearing' | 'merchant') => void
}) {
  return (
    <View className='search-bar'>
      <View className='search-bar__tabs'>
        <Text
          className={`search-bar__tab ${searchType === 'bearing' ? 'active' : ''}`}
          onClick={() => onTypeChange('bearing')}
        >轴承</Text>
        <Text
          className={`search-bar__tab ${searchType === 'merchant' ? 'active' : ''}`}
          onClick={() => onTypeChange('merchant')}
        >商家</Text>
      </View>
      <input
        className='search-bar__input'
        placeholder={searchType === 'bearing' ? '搜索型号/品牌' : '搜索商家'}
        value={keyword}
        onInput={(e) => onKeywordChange(e.detail.value)}
        onConfirm={onSearch}
      />
      <Button className='search-bar__btn' onClick={onSearch}>搜索</Button>
    </View>
  )
}
