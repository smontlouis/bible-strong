import React from 'react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { ConflictParent, ConflictItem } from '~state/app'

interface DiffProps {
  type: 'added' | 'updated' | 'deleted'
  data: ConflictParent[] | undefined
}

const RecursiveText = ({
  type,
  content,
  children,
  level,
}: ConflictItem & { type: DiffProps['type']; level: number }) => {
  return (
    <Box marginTop={0}>
      {content && (
        <Text text>
          <Text color={getTitleColor(type)}>{getSign(type)} </Text>
          {content}
        </Text>
      )}
      {children?.map((t, i) => (
        <Box key={i} marginLeft={15}>
          <RecursiveText
            level={level + 1}
            type={type}
            content={t.content}
            children={t.children}
          />
        </Box>
      ))}
    </Box>
  )
}

const getTitleColor = (type: DiffProps['type']) => {
  switch (type) {
    case 'added':
      return 'success'
    case 'updated':
      return 'secondary'
    case 'deleted':
      return 'quart'
  }
}

const getSign = (type: DiffProps['type']) => {
  switch (type) {
    case 'added':
      return '+'
    case 'updated':
      return '/'
    case 'deleted':
      return '-'
  }
}

const useTitle = (type: DiffProps['type']) => {
  const { t } = useTranslation()
  switch (type) {
    case 'added':
      return t('conflict.added')
    case 'updated':
      return t('conflict.updated')
    case 'deleted':
      return t('conflict.deleted')
  }
}

const DiffComponent = ({ type, data }: DiffProps) => {
  const title = useTitle(type)

  if (!data?.length) return null
  return (
    <Box marginTop={20}>
      <Text title fontSize={18} color={getTitleColor(type)}>
        {title}
      </Text>
      {data.map((t, i) => (
        <RecursiveText
          key={i}
          level={0}
          type={type}
          content={t.content}
          children={t.children}
        />
      ))}
    </Box>
  )
}

export default DiffComponent
