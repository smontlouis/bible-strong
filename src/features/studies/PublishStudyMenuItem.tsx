import React, { useEffect, useState } from 'react'
import slugify from 'slugify'
import RNFetchBlob from 'rn-fetch-blob'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { Study, publishStudy } from '~redux/modules/user'
import Border from '~common/ui/Border'
import { LinkBox } from '~common/Link'
import to from 'await-to-js'
import { Status } from '~common/types'
import { ActivityIndicator } from 'react-native-paper'
import { useDispatch } from 'react-redux'
import useConnection from '~helpers/useConnection'
import Clipboard from '@react-native-community/clipboard'
import SnackBar from '~common/SnackBar'
import { Share, Platform, PermissionsAndroid } from 'react-native'
import { useTranslation } from 'react-i18next'

interface Props {
  study: Study
  onClosed: () => void
}

const useStudyStatus = (study: Study) => {
  const { current: url } = React.useRef(
    `https://bible-strong.app/studies/${study.id}`
  )
  const [status, setStatus] = useState<Status>('Idle')
  const [data, setData] = useState<number>()
  const [error, setError] = useState<Error>()

  useEffect(() => {
    ;(async () => {
      if (!study.published) return

      setStatus('Pending')
      const [err, response] = await to(fetch(url))
      if (!err) {
        setStatus('Resolved')
        setData(response?.status)
      } else {
        setStatus('Rejected')
        setError(err)
      }
    })()
  }, [study.published, study.id, url])

  return { url, status, data, error }
}

const PublishStudyMenuItem = ({ study, onClosed }: Props) => {
  const { status, data, url } = useStudyStatus(study)
  const [pdfStatus, setPDFStatus] = useState<Status>('Idle')
  const isConnected = useConnection()
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const onPublishStudy = () => isConnected && dispatch(publishStudy(study.id))

  const copyToClipboard = async (url: string) => {
    Clipboard.setString(url)
    SnackBar.show(t('Copié dans le presse-papiers.'))
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
            message: t(
              'Bible Strong aimerait stocker les études dans votre dossier "Downloads"'
            ),
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
      console.log(e)
      setPDFStatus('Rejected')
    }
  }

  return (
    <>
      {study.published ? (
        <>
          <Box p={20}>
            {status === 'Pending' && (
              <Box row alignItems="center" py={10}>
                <ActivityIndicator size={20} />
                <Text ml={20}>{t('Chargement')}</Text>
              </Box>
            )}
            {status === 'Resolved' && (
              <>
                {data === 200 ? (
                  <LinkBox
                    row
                    alignItems="center"
                    py={10}
                    onPress={() => dispatch(publishStudy(study.id, false))}
                  >
                    <FeatherIcon name="link-2" color="success" size={20} />
                    <Text ml={20}>{t("Dépublier l'étude")}</Text>
                  </LinkBox>
                ) : (
                  <Box row alignItems="center" py={10}>
                    <FeatherIcon name="link-2" color="secondary" size={20} />
                    <Text color="grey" ml={20}>
                      {t('Publication en cours...')}
                    </Text>
                  </Box>
                )}
              </>
            )}
            {status === 'Rejected' && (
              <Box row alignItems="center" py={10}>
                <FeatherIcon name="link-2" color="quart" size={20} />
                <Text ml={20}>{t('Impossible de vérifier le lien')}</Text>
              </Box>
            )}

            <LinkBox row alignItems="center" py={10} href={url}>
              <FeatherIcon name="external-link" size={20} />
              <Text ml={20}>{t('Ouvrir le lien')}</Text>
            </LinkBox>
            <LinkBox
              row
              alignItems="center"
              py={10}
              onPress={() => {
                copyToClipboard(url)
                onClosed()
              }}
            >
              <FeatherIcon name="copy" size={20} />
              <Text ml={20}>{t('Copier le lien')}</Text>
            </LinkBox>
            <LinkBox
              row
              alignItems="center"
              py={10}
              onPress={async () => {
                const result = await shareVerse(
                  study.title,
                  study.user.displayName,
                  url
                )
                if (result.action === Share.sharedAction) {
                  onClosed()
                }
              }}
            >
              <FeatherIcon name="share-2" size={20} />
              <Text ml={20}>{t('Partager')}</Text>
            </LinkBox>
            {(pdfStatus === 'Idle' || pdfStatus === 'Rejected') && (
              <LinkBox
                row
                alignItems="center"
                py={10}
                onPress={() => exportPDF()}
              >
                <MaterialIcon name="picture-as-pdf" size={20} />
                {pdfStatus === 'Idle' ? (
                  <Text ml={20}>{t('Exporter en pdf')}</Text>
                ) : (
                  <Text color="quart" ml={20}>
                    {t("Une erreur s'est produite. Réessayer ?")}
                  </Text>
                )}
              </LinkBox>
            )}
            {pdfStatus === 'Pending' && (
              <Box disabled row alignItems="center" py={10}>
                <ActivityIndicator size={20} />
                <Text ml={20}>{t('Génération du pdf...')}</Text>
              </Box>
            )}
            {pdfStatus === 'Resolved' && (
              <Box row alignItems="center" py={10}>
                <MaterialIcon name="picture-as-pdf" size={20} />
                <Text ml={20}>{t('Ouverture du fichier...')}</Text>
              </Box>
            )}
          </Box>
          <Border />
        </>
      ) : (
        <>
          <Box p={20}>
            <LinkBox
              row
              alignItems="center"
              onPress={onPublishStudy}
              disabled={!isConnected}
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
