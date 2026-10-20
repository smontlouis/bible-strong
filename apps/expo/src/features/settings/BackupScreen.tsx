import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'

const BackupScreen = () => {
  const { t } = useTranslation()

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('backup.title')} />
      <ScrollView backgroundColor="canvas" style={{ flex: 1 }}>
        <ListSection>
          <ListRow
            route="ImportExport"
            icon={<FeatherIcon name="upload" size={18} color="grey" />}
            label={t('app.importexport')}
          />
          <ListRow
            route="AutomaticBackups"
            icon={<FeatherIcon name="save" size={18} color="grey" />}
            label={t('backups.title')}
          />
        </ListSection>
      </ScrollView>
    </Container>
  )
}

export default BackupScreen
