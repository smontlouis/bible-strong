import format from 'date-fns/format'
import { enGB, fr } from 'date-fns/locale'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, TouchableOpacity } from 'react-native'
import Modal from 'react-native-modalbox'
import { useSnapshot } from 'valtio'
import Text from '~common/ui/Text'
import { useSelector } from 'react-redux'
import formatVerseContent from '~helpers/formatVerseContent'
import useLanguage from '~helpers/useLanguage'
import i18n from '~i18n'
import styled from '~styled/index'
import {
  ConflictItem,
  ConflictParent,
  conflictStateProxy,
  Diff,
} from '../state/app'
import Box from './ui/Box'
import ScrollView from './ui/ScrollView'
import { RootState } from '~redux/modules/reducer'
import DiffComponent from './DiffComponent'
import { FeatherIcon } from './ui/Icon'

const StylizedModal = styled(Modal)(({ theme }) => ({
  height: 500,
  width: '95%',
  maxWidth: 500,
  minWidth: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  overflow: 'hidden',
}))

const useReadableConflict = (diffObj?: Diff) => {
  const state = useSelector((state: RootState) => ({
    tags: state.user.bible.tags,
    studies: state.user.bible.studies,
    strongsGrec: state.user.bible.strongsGrec,
    strongsHebreu: state.user.bible.strongsHebreu,
    naves: state.user.bible.naves,
    words: state.user.bible.words,
  }))

  const { tags, studies } = state

  const getAddedReadableConflict = (
    diff?: Diff
  ): ConflictParent[] | undefined => {
    if (!diff?.added?.bible) return

    const getHighlightValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent([key])
        return {
          content: i18n.t('conflict.highlightAdded', { highlight: title }),
        } as ConflictItem
      })

    const getTagValues = (values: {
      [x: string]: { name: string; [y: string]: any }
    }) =>
      Object.entries(values)
        .map(([key, value]) => {
          if (value.name) {
            return {
              content: i18n.t('conflict.tagAdded', { tag: `${value.name}` }),
            }
          }
        })
        .filter(x => x) as ConflictItem[]

    const getStrongValues = (values: { [x: string]: any }, entity) =>
      Object.entries(values).map(([key, value]) => {
        return {
          content: i18n.t('conflict.tagInEntity', {
            name: state?.[entity]?.[key]?.title,
          }),
          children: Object.values(value.tags).map(v => ({
            content: `${v.name}`,
          })),
        } as ConflictItem
      })

    const getNoteValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent(key.split('/'))
        if (value.title) {
          return {
            content: i18n.t('conflict.noteAdded', { note: title }),
          } as ConflictItem
        }

        return {
          content: i18n.t('conflict.noteTagAdded', { note: title }),
          children: Object.values(value.tags).map(v => ({
            content: `${v.name}`,
          })),
        } as ConflictItem
      })

    const getStudyValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        if (value.id) {
          return {
            content: i18n.t('conflict.studyAdded', { study: value.title }),
          } as ConflictItem
        }

        return {
          content: i18n.t('conflict.studyTagAdded', {
            study: studies?.[key]?.title,
          }),
          children: Object.values(value.tags).map(v => ({
            content: `${v.name}`,
          })),
        } as ConflictItem
      })

    return Object.entries(diff?.added?.bible)
      .map(([entity, values]) => {
        switch (entity) {
          case 'highlights':
            return {
              entity,
              children: getHighlightValues(values as any),
            }
          case 'tags':
            return {
              entity,
              children: getTagValues(values as any),
            }
          case 'words':
          case 'naves':
          case 'strongsHebreu':
          case 'strongsGrec':
            return {
              entity,
              content: i18n.t(`conflict.${entity}`),
              children: getStrongValues(values as any, entity),
            }
          case 'notes':
            return {
              entity,
              children: getNoteValues(values as any),
            }
          case 'studies':
            return {
              entity,
              children: getStudyValues(values as any),
            }
          case 'plan':
          case 'settings': {
            return
          }
        }
      })
      .filter(x => x) as ConflictParent[]
  }

  const getUpdatedReadableConflict = (
    diff?: Diff
  ): ConflictParent[] | undefined => {
    if (!diff?.updated?.bible) return

    const getHighlightValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent([key])
        return {
          content: i18n.t('conflict.highlightModified', { highlight: title }),
        } as ConflictItem
      })

    const getTagValues = (values: {
      [x: string]: { name: string; [y: string]: any }
    }) =>
      Object.entries(values)
        .map(([key, value]) => {
          if (value.name) {
            return {
              content: i18n.t('conflict.tagModified', {
                tag: `-${value.name}`,
              }),
            }
          }
        })
        .filter(x => x) as ConflictItem[]

    const getNoteValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent(key.split('/'))
        return {
          content: i18n.t('conflict.noteModified', { note: title }),
        } as ConflictItem
      })

    const getStudyValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        // TODO * get study title
        return {
          content: i18n.t('conflict.studyModified', { study: value.title }),
        } as ConflictItem
      })

    return Object.entries(diff?.updated?.bible)
      .map(([entity, values]) => {
        switch (entity) {
          case 'highlights':
            return {
              entity,
              children: getHighlightValues(values as any),
            }
          case 'tags':
            return {
              entity,
              children: getTagValues(values as any),
            }
          case 'notes':
            return {
              entity,
              children: getNoteValues(values as any),
            }
          case 'studies':
            return {
              entity,
              children: getStudyValues(values as any),
            }

          case 'settings': {
            return {
              entity,
              content: i18n.t('conflict.settingsModified'),
            }
          }
          // case 'plan': {
          //   return
          // }
        }
      })
      .filter(x => x) as ConflictParent[]
  }

  const getDeletedReadableConflict = (
    diff?: Diff
  ): ConflictParent[] | undefined => {
    if (!diff?.deleted?.bible) return

    const getHighlightValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent([key])

        if (value?.tags) {
          return {
            content: i18n.t('conflict.tagInEntityDeleted', {
              entity: title,
            }),
            children: Object.keys(value.tags).map(v => ({
              content: `${tags?.[v]?.name}`,
            })),
          } as ConflictItem
        }
        return {
          content: i18n.t('conflict.highlightDeleted', { highlight: title }),
        } as ConflictItem
      })

    const getTagValues = (values: {
      [x: string]: { name: string; [y: string]: any }
    }) =>
      Object.entries(values)
        .map(([key, value]) => {
          if (value === true) {
            return {
              content: i18n.t('conflict.tagDeleted', {
                tag: tags?.[key]?.name,
              }),
            }
          }
        })
        .filter(x => x) as ConflictItem[]

    const getStrongValues = (values: { [x: string]: any }, entity) =>
      Object.entries(values).map(([key, value]) => {
        if (value.tags) {
          return {
            content: i18n.t('conflict.tagInEntityDeleted', {
              entity: state?.[entity]?.[key]?.title,
            }),
            children: Object.keys(value.tags).map(v => ({
              content: `${tags?.[v]?.name}`,
            })),
          } as ConflictItem
        }

        return {
          content: i18n.t('conflict.tagInEntityDeleted', {
            entity: state?.[entity]?.[key]?.title,
          }),
        } as ConflictItem
      })

    const getNoteValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        const { title } = formatVerseContent(key.split('/'))

        if (value?.tags) {
          return {
            content: i18n.t('conflict.noteTagDeleted', { note: title }),
            children: Object.keys(value.tags).map(v => ({
              content: tags?.[v]?.name,
            })),
          } as ConflictItem
        }

        return {
          content: i18n.t('conflict.noteDeleted', { note: title }),
        } as ConflictItem
      })

    const getStudyValues = (values: { [x: string]: any }) =>
      Object.entries(values).map(([key, value]) => {
        if (value === true) {
          return {
            content: i18n.t('conflict.studyDeleted', {
              study: studies?.[key]?.title,
            }),
          } as ConflictItem
        }

        if (value.tag) {
          return {
            content: i18n.t('conflict.studyTagDeleted'),
            children: Object.keys(value.tags).map(v => ({
              content: tags?.[v]?.name,
            })),
          } as ConflictItem
        }

        return {
          content: i18n.t('conflict.studyDeleted', {
            study: studies?.[key]?.title,
          }),
        } as ConflictItem
      })

    return Object.entries(diff?.deleted?.bible)
      .map(([entity, values]) => {
        switch (entity) {
          case 'highlights':
            return {
              entity,
              children: getHighlightValues(values as any),
            }
          case 'tags':
            return {
              entity,
              children: getTagValues(values as any),
            }
          case 'words':
          case 'naves':
          case 'strongsHebreu':
          case 'strongsGrec':
            return {
              entity,
              content: i18n.t(`conflict.${entity}`),
              children: getStrongValues(values as any, entity),
            }
          case 'notes':
            return {
              entity,
              children: getNoteValues(values as any),
            }
          case 'studies':
            return {
              entity,
              children: getStudyValues(values as any),
            }
          case 'plan':
          case 'settings': {
            return
          }
        }
      })
      .filter(x => x) as ConflictParent[]
  }

  return {
    added: getAddedReadableConflict(diffObj),
    updated: getUpdatedReadableConflict(diffObj),
    deleted: getDeletedReadableConflict(diffObj),
  }
}

const ConflictModal = () => {
  const { diff, onDispatchUserSuccess, lastSeen, remoteLastSeen } = useSnapshot(
    conflictStateProxy
  )
  const { t } = useTranslation()
  const isFR = useLanguage()

  const { added, updated, deleted } = useReadableConflict(diff)

  if (diff) {
    console.log({ added, updated, deleted })
  }
  return (
    <StylizedModal
      isOpen={!!diff}
      backdropPressToClose={false}
      swipeToClose={false}
    >
      <ScrollView
        contentContainerStyle={{ paddingVertical: 40, paddingHorizontal: 20 }}
      >
        <Text title fontSize={19} marginBottom={20}>
          {t('conflict.title')}
        </Text>
        <Text text>{t('conflict.description')}</Text>
        <DiffComponent type="added" data={added} />
        <DiffComponent type="updated" data={updated} />
        <DiffComponent type="deleted" data={deleted} />

        <Text text marginTop={20}>
          {t('conflict.whattodo')}
        </Text>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(t('Attention'), t('app.areyousure'), [
              { text: t('Non'), onPress: () => null, style: 'cancel' },
              {
                text: t('Oui'),
                onPress: () => {
                  onDispatchUserSuccess?.(true)
                  conflictStateProxy.diff = undefined
                  conflictStateProxy.onDispatchUserSuccess = undefined
                  conflictStateProxy.lastSeen = undefined
                  conflictStateProxy.remoteLastSeen = undefined
                },
                style: 'destructive',
              },
            ])
          }}
        >
          <Box
            marginTop={20}
            row
            alignItems="center"
            borderRadius={8}
            bg="lightGrey"
            padding={10}
          >
            <Box paddingRight={10}>
              <FeatherIcon name="save" size={24} color="grey" />
            </Box>
            <Box>
              <Text marginBottom={10}>{t('conflict.local')}</Text>
              <Text fontSize={12}>{t('conflict.localDescription')}</Text>
              <Box marginTop={5} row justifyContent="flex-end">
                <Text text fontSize={10} bold color="grey">
                  {t('conflict.lastLocalSave').toUpperCase()}:&nbsp;
                </Text>
                <Text text fontSize={10}>
                  {format(new Date(lastSeen || 0), 'PPpp', {
                    locale: isFR ? fr : enGB,
                  })}
                </Text>
              </Box>
            </Box>
          </Box>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(t('Attention'), t('app.areyousure'), [
              { text: t('Non'), onPress: () => null, style: 'cancel' },
              {
                text: t('Oui'),
                onPress: () => {
                  onDispatchUserSuccess?.()
                  conflictStateProxy.diff = undefined
                  conflictStateProxy.onDispatchUserSuccess = undefined
                  conflictStateProxy.lastSeen = undefined
                  conflictStateProxy.remoteLastSeen = undefined
                },
                style: 'destructive',
              },
            ])
          }}
        >
          <Box
            row
            alignItems="center"
            marginTop={20}
            borderRadius={8}
            bg="lightPrimary"
            padding={10}
          >
            <Box paddingRight={10}>
              <FeatherIcon name="cloud" size={24} color="primary" />
            </Box>

            <Box>
              <Text marginBottom={10} bold color="primary">
                {t('conflict.cloud')}
              </Text>
              <Text fontSize={12}>{t('conflict.cloudDescription')}</Text>
              <Box marginTop={5} row justifyContent="flex-end">
                <Text text fontSize={10} bold color="grey">
                  {t('conflict.lastOnlineSave').toUpperCase()}:&nbsp;
                </Text>
                <Text text fontSize={10}>
                  {format(new Date(remoteLastSeen || 0), 'PPpp', {
                    locale: isFR ? fr : enGB,
                  })}
                </Text>
              </Box>
            </Box>
          </Box>
        </TouchableOpacity>
      </ScrollView>
    </StylizedModal>
  )
}

export default ConflictModal
