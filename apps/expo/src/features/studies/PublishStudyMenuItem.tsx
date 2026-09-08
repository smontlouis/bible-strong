import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Linking, PermissionsAndroid, Platform, Share } from 'react-native'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useDispatch } from 'react-redux'
import slugify from 'slugify'
import { LinkBox } from '~common/Link'
import { toast } from '~helpers/toast'
import { Status } from '~common/types'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useConnection from '~helpers/useConnection'
import { publishStudy, Study } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import Clipboard from '@react-native-clipboard/clipboard'
import { remoteQueryOptions } from '~helpers/queryOptions'
interface Props {
  study: Study
  onClosed: () => void
}

const useStudyStatus = (study: Study) => {
  const url = `https://bible-strong.app/studies/${study.id}`
  const query = useQuery({
    queryKey: ['published-study-status', study.id],
    queryFn: async () => {
      const response = await fetch(url)
      return response.status
    },
    enabled: study.published,
    ...remoteQueryOptions,
  })
  const status: Status = !study.published
    ? 'Idle'
    : query.fetchStatus === 'paused'
      ? 'Rejected'
      : query.isPending
        ? 'Pending'
        : query.isError
          ? 'Rejected'
          : 'Resolved'

  return { url, status, data: query.data }
}

const PublishStudyMenuItem = ({ study, onClosed }: Props) => {
  const { status, data, url } = useStudyStatus(study)
  const [pdfStatus, setPDFStatus] = useState<Status>('Idle')
  const isConnected = useConnection()
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()

  const onPublishStudy = () => isConnected && dispatch(publishStudy(study.id))

  const copyToClipboard = async (url: string) => {
    Clipboard.setString(url)
    toast(t('Copié dans le presse-papiers.'))
  }

  const shareVerse = async (title: string, userName: string, url: string) => {
    const result = await Share.share({
      message: `${title}, ${t('créé par')} ${userName}
    ${url}`,
    })
    return result
  }

  const exportPDF = async () => {
    try {
      if (Platform.OS === 'web') return
      const { default: RNFetchBlob } = await import('rn-fetch-blob')
      setPDFStatus('Pending')
      const file_name = slugify(study.title)
      const dirPath = Platform.select({
        ios: RNFetchBlob.fs.dirs.DocumentDir,
        android: RNFetchBlob.fs.dirs.DownloadDir,
      })
      const filePath = `${dirPath}/${file_name}.pdf`

      const options = Platform.select({
        ios: {
          fileCache: true,
          path: filePath,
          appendExt: 'pdf',
          indicator: true,
        },
        android: {
          fileCache: true,
          appendExt: 'pdf',
          path: filePath,
        },
      })

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: t('Accès au dossier de téléchargement'),
            message: t('Bible Strong aimerait stocker les études dans votre dossier "Downloads"'),
            buttonNeutral: t('Demandez plus tard'),
            buttonNegative: t('Annuler'),
            buttonPositive: t('Ok'),
          }
        )

        if (granted === 'denied') {
          setPDFStatus('Rejected')
          return
        }
      }

      const res = await RNFetchBlob.config(options!).fetch(
        'POST',
        'https://us-central1-bible-strong-app.cloudfunctions.net/exportStudyPDF',
        {
          'Content-Type': 'application/json',
        },
        JSON.stringify({ studyId: study.id })
      )

      const resStatus = res.info().status

      if (resStatus !== 200) {
        setPDFStatus('Rejected')
        return
      }

      setPDFStatus('Resolved')

      if (Platform.OS === 'ios') {
        onClosed()
        setTimeout(() => {
          RNFetchBlob.ios.openDocument(res.path())
        }, 500)
      }

      if (Platform.OS === 'android') {
        onClosed()
        setTimeout(() => {
          RNFetchBlob.android.actionViewIntent(res.path(), 'application/pdf')
        }, 500)
      }
    } catch (e) {
      console.log('[Studies] Error generating PDF:', e)
      setPDFStatus('Rejected')
    }
  }

  if (Platform.OS === 'web') {
    return (
      <Box className="pb-1 mb-1 border-b border-border">
        {!study.published ? (
          <PanelAction
            icon="upload-cloud"
            label={t("Publier l'étude")}
            disabled={!isConnected}
            onPress={onPublishStudy}
          />
        ) : (
          <>
            {status === 'Resolved' && data === 200 ? (
              <PanelAction
                icon="link-2"
                label={t("Dépublier l'étude")}
                onPress={() => dispatch(publishStudy(study.id, false))}
              />
            ) : (
              <Box className="flex-row items-center gap-3 p-3">
                {status === 'Pending' ? (
                  <ActivityIndicator size={17} />
                ) : (
                  <FeatherIcon
                    name="link-2"
                    size={17}
                    color={status === 'Rejected' ? 'quart' : 'tertiary'}
                  />
                )}
                <Text className="flex-1 text-[14px] text-tertiary">
                  {t(
                    status === 'Pending'
                      ? 'Chargement'
                      : status === 'Rejected'
                        ? 'Impossible de vérifier le lien'
                        : 'Publication en cours...'
                  )}
                </Text>
              </Box>
            )}
            <PanelAction
              icon="external-link"
              label={t('Ouvrir le lien')}
              onPress={() => {
                void Linking.openURL(url)
              }}
            />
            <PanelAction
              icon="copy"
              label={t('Copier le lien')}
              onPress={() => {
                void copyToClipboard(url)
                onClosed()
              }}
            />
            <PanelAction
              icon="share-2"
              label={t('Partager')}
              onPress={async () => {
                const result = await shareVerse(study.title, study.user.displayName, url)
                if (result.action === Share.sharedAction) onClosed()
              }}
            />
          </>
        )}
      </Box>
    )
  }

  return (
    <>
      {study.published ? (
        <>
          <Box className="overflow-hidden border-continuous p-[20px]">
            {status === 'Pending' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <ActivityIndicator size={20} />
                <Text className="ml-[20px]">{t('Chargement')}</Text>
              </Box>
            )}
            {status === 'Resolved' && (
              <>
                {data === 200 ? (
                  <LinkBox
                    className="py-[10px] items-center flex-row"
                    onPress={() => dispatch(publishStudy(study.id, false))}
                  >
                    <FeatherIcon name="link-2" color="success" size={20} />
                    <Text className="ml-[20px]">{t("Dépublier l'étude")}</Text>
                  </LinkBox>
                ) : (
                  <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                    <FeatherIcon name="link-2" color="secondary" size={20} />
                    <Text className="text-grey ml-[20px]">{t('Publication en cours...')}</Text>
                  </Box>
                )}
              </>
            )}
            {status === 'Rejected' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <FeatherIcon name="link-2" color="quart" size={20} />
                <Text className="ml-[20px]">{t('Impossible de vérifier le lien')}</Text>
              </Box>
            )}

            <LinkBox className="py-[10px] items-center flex-row" href={url}>
              <FeatherIcon name="external-link" size={20} />
              <Text className="ml-[20px]">{t('Ouvrir le lien')}</Text>
            </LinkBox>
            <LinkBox
              className="py-[10px] items-center flex-row"
              onPress={() => {
                copyToClipboard(url)
                onClosed()
              }}
            >
              <FeatherIcon name="copy" size={20} />
              <Text className="ml-[20px]">{t('Copier le lien')}</Text>
            </LinkBox>
            <LinkBox
              className="py-[10px] items-center flex-row"
              onPress={async () => {
                const result = await shareVerse(study.title, study.user.displayName, url)
                if (result.action === Share.sharedAction) {
                  onClosed()
                }
              }}
            >
              <FeatherIcon name="share-2" size={20} />
              <Text className="ml-[20px]">{t('Partager')}</Text>
            </LinkBox>
            {(pdfStatus === 'Idle' || pdfStatus === 'Rejected') && (
              <LinkBox className="py-[10px] items-center flex-row" onPress={() => exportPDF()}>
                <MaterialIcon name="picture-as-pdf" size={20} />
                {pdfStatus === 'Idle' ? (
                  <Text className="ml-[20px]">{t('Exporter en pdf')}</Text>
                ) : (
                  <Text className="text-quart ml-[20px]">
                    {t("Une erreur s'est produite. Réessayer ?")}
                  </Text>
                )}
              </LinkBox>
            )}
            {pdfStatus === 'Pending' && (
              <Box
                className="overflow-hidden border-continuous flex-row items-center py-[10px]"
                style={{ opacity: 0.6 }}
              >
                <ActivityIndicator size={20} />
                <Text className="ml-[20px]">{t('Génération du pdf...')}</Text>
              </Box>
            )}
            {pdfStatus === 'Resolved' && (
              <Box className="overflow-hidden border-continuous flex-row items-center py-[10px]">
                <MaterialIcon name="picture-as-pdf" size={20} />
                <Text className="ml-[20px]">{t('Ouverture du fichier...')}</Text>
              </Box>
            )}
          </Box>
          <Border />
        </>
      ) : (
        <>
          <Box className="overflow-hidden border-continuous p-[20px]">
            <LinkBox
              className="items-center flex-row"
              onPress={onPublishStudy}
              disabled={!isConnected}
              style={[{ opacity: !isConnected ? 0.6 : 1 }, [{ opacity: !isConnected ? 0.6 : 1 }]]}
            >
              <Text>{t("Publier l'étude")}</Text>
            </LinkBox>
          </Box>
          <Border />
        </>
      )}
    </>
  )
}

export default PublishStudyMenuItem
