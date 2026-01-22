import React, { useState, useMemo } from 'react'
import { FlatList } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'

import Header from '~common/Header'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import verseToReference from '~helpers/verseToReference'

const Container = styled.View(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.lightGrey,
}))

const TabContainer = styled.View(({ theme }) => ({
  flexDirection: 'row',
  backgroundColor: theme.colors.reverse,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
  paddingHorizontal: 16,
}))

const Tab = styled.TouchableOpacity<{ active: boolean }>(({ theme, active }) => ({
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 2,
  borderBottomColor: active ? theme.colors.primary : 'transparent',
}))

const TabText = styled.Text<{ active: boolean }>(({ theme, active }) => ({
  fontSize: 14,
  fontWeight: active ? 'bold' : 'normal',
  color: active ? theme.colors.primary : theme.colors.tertiary,
}))

const AnnotationCard = styled.TouchableOpacity(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  marginHorizontal: 16,
  marginVertical: 8,
  padding: 16,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: theme.colors.border,
}))

const AnnotationText = styled.Text(({ theme }) => ({
  fontSize: 16,
  color: theme.colors.default,
  marginBottom: 8,
}))

const AnnotationMeta = styled.Text(({ theme }) => ({
  fontSize: 13,
  color: theme.colors.tertiary,
}))

const EmptyState = styled.View({
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 32,
})

const EmptyText = styled.Text(({ theme }) => ({
  fontSize: 16,
  color: theme.colors.tertiary,
  textAlign: 'center',
}))

type ViewMode = 'verse' | 'date' | 'flat'

const WordAnnotationsScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('verse')

  // Get all annotations from Redux
  const annotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)

  // Convert to array and sort
  const annotationsList = useMemo(() => {
    const list = Object.entries(annotations).map(([, annotation]) => ({
      ...annotation,
    }))

    // Sort by date (newest first)
    return list.sort((a, b) => b.date - a.date)
  }, [annotations])

  // Group by verse
  const groupedByVerse = useMemo(() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      // Use first range's verseKey as primary key
      const verseKey = annotation.ranges[0]?.verseKey
      if (!verseKey) return

      if (!groups.has(verseKey)) {
        groups.set(verseKey, [])
      }
      groups.get(verseKey)!.push(annotation)
    })

    return Array.from(groups.entries()).map(([verseKey, annotations]) => ({
      verseKey,
      reference: verseToReference({ [verseKey]: true }),
      annotations,
    }))
  }, [annotationsList])

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      const date = new Date(annotation.date)
      const dateKey = date.toLocaleDateString()

      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(annotation)
    })

    return Array.from(groups.entries()).map(([date, annotations]) => ({
      date,
      annotations,
    }))
  }, [annotationsList])

  // Handle annotation tap - navigate to Bible verse
  const handleAnnotationPress = (annotation: WordAnnotation & { id: string }) => {
    const firstRange = annotation.ranges[0]
    if (!firstRange) return

    const [book, chapter, verse] = firstRange.verseKey.split('-').map(Number)
    router.push({
      pathname: '/bible-view',
      params: {
        isReadOnly: 'true',
        book: String(book),
        chapter: String(chapter),
        verse: String(verse),
      },
    })
  }

  // Render annotation card
  const renderAnnotationCard = (annotation: WordAnnotation & { id: string }) => {
    // Combine all text from ranges
    const allText = annotation.ranges.map(r => r.text).join(' ... ')
    const reference = verseToReference(
      annotation.ranges.reduce((acc, r) => ({ ...acc, [r.verseKey]: true }), {})
    )

    return (
      <AnnotationCard key={annotation.id} onPress={() => handleAnnotationPress(annotation)}>
        <AnnotationText numberOfLines={3}>{allText}</AnnotationText>
        <AnnotationMeta>
          {reference} • {annotation.version}
          {annotation.noteId && ` • ${t('Contient une note')}`}
        </AnnotationMeta>
      </AnnotationCard>
    )
  }

  // Render content based on view mode
  const renderContent = () => {
    if (annotationsList.length === 0) {
      return (
        <EmptyState>
          <EmptyText>{t("Vous n'avez pas encore annoté de mots...")}</EmptyText>
        </EmptyState>
      )
    }

    if (viewMode === 'verse') {
      return (
        <FlatList
          data={groupedByVerse}
          keyExtractor={item => item.verseKey}
          renderItem={({ item }) => (
            <Box>
              <Box px={16} py={8}>
                <Text fontSize={14} fontWeight="bold" color={theme.colors.tertiary}>
                  {item.reference}
                </Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    if (viewMode === 'date') {
      return (
        <FlatList
          data={groupedByDate}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <Box>
              <Box px={16} py={8}>
                <Text fontSize={14} fontWeight="bold" color={theme.colors.tertiary}>
                  {item.date}
                </Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    // Flat list
    return (
      <FlatList
        data={annotationsList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => renderAnnotationCard(item)}
      />
    )
  }

  return (
    <Container>
      <Header title={t('Annotations')} hasBackButton />

      <TabContainer>
        <Tab active={viewMode === 'verse'} onPress={() => setViewMode('verse')}>
          <TabText active={viewMode === 'verse'}>{t('Par verset')}</TabText>
        </Tab>
        <Tab active={viewMode === 'date'} onPress={() => setViewMode('date')}>
          <TabText active={viewMode === 'date'}>{t('Par date')}</TabText>
        </Tab>
        <Tab active={viewMode === 'flat'} onPress={() => setViewMode('flat')}>
          <TabText active={viewMode === 'flat'}>{t('Liste')}</TabText>
        </Tab>
      </TabContainer>

      {renderContent()}
    </Container>
  )
}

export default WordAnnotationsScreen
