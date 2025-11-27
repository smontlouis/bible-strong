import * as FileSystem from 'expo-file-system'
import * as Sentry from '@sentry/react-native'
import { RootState } from '~redux/modules/reducer'

/**
 * AutoBackupManager - Système de backup automatique local
 *
 * Garantit qu'aucune donnée utilisateur ne peut être perdue en créant
 * des backups JSON automatiques sur le disque local.
 *
 * Fonctionnalités:
 * - Backup automatique maximum 1 par jour (24h entre auto backups, si données changées)
 * - Backups logout/erreur/manuels créés sans restriction
 * - Rotation des 10 derniers backups (tous types confondus)
 * - Backup immédiat avant logout
 * - Backup immédiat sur erreur de sync
 * - Validation d'intégrité des backups
 */
class AutoBackupManager {
  private backupDir = `${FileSystem.documentDirectory}backups/`
  private pendingBackup: NodeJS.Timeout | null = null
  private readonly BACKUP_DEBOUNCE = 30 * 1000 // 30 secondes (debounce court pour éviter trop d'appels)
  private readonly AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 heures entre auto backups
  private readonly MAX_BACKUPS = 10 // Garder les 10 derniers (tous types confondus)
  private lastAutoBackupTime: number = 0
  private isInitialized = false

  /**
   * Initialise le système de backup (crée le dossier si nécessaire)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.backupDir)

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.backupDir, { intermediates: true })
        console.log('[AutoBackup] Backup directory created:', this.backupDir)
      }

      this.isInitialized = true
      console.log('[AutoBackup] Initialized')
    } catch (error) {
      console.error('[AutoBackup] Failed to initialize:', error)
      Sentry.captureException(error, {
        tags: { feature: 'auto_backup', action: 'initialize' }
      })
    }
  }

  /**
   * Schedule un backup avec debounce
   * Évite de créer trop de backups lors de changements rapides
   * Maximum 1 auto backup par 24h
   */
  scheduleBackup(state: RootState): void {
    // Cancel le backup précédent s'il existe
    if (this.pendingBackup) {
      clearTimeout(this.pendingBackup)
    }

    // Schedule nouveau backup dans 30s (le backup vérifiera si 24h se sont écoulées)
    this.pendingBackup = setTimeout(() => {
      this.createBackup(state, 'auto')
    }, this.BACKUP_DEBOUNCE)
  }

  /**
   * Crée un backup immédiat (pas de debounce)
   * Utilisé pour logout, erreurs de sync, etc.
   */
  async createBackupNow(state: RootState, trigger: BackupTrigger): Promise<boolean> {
    // Cancel le backup pending s'il existe
    if (this.pendingBackup) {
      clearTimeout(this.pendingBackup)
      this.pendingBackup = null
    }

    return this.createBackup(state, trigger)
  }

  /**
   * Crée un backup des données utilisateur
   */
  private async createBackup(
    state: RootState,
    trigger: BackupTrigger
  ): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Sanitize les données (enlève changelog et studies qui sont dans une autre collection)
      const sanitizeUserBible = ({ changelog, studies, ...rest }: any) => rest

      const newData = {
        bible: sanitizeUserBible(state.user.bible),
        plan: state.plan.ongoingPlans,
        studies: state.user.bible.studies
      }

      // Restrictions UNIQUEMENT pour auto backups
      if (trigger === 'auto') {
        // Vérifier si 24h se sont écoulées depuis le dernier auto backup
        const timeSinceLastAutoBackup = Date.now() - this.lastAutoBackupTime
        if (timeSinceLastAutoBackup < this.AUTO_BACKUP_INTERVAL) {
          const hoursRemaining = Math.ceil((this.AUTO_BACKUP_INTERVAL - timeSinceLastAutoBackup) / (60 * 60 * 1000))
          console.log(`[AutoBackup] Auto backup skipped (next in ~${hoursRemaining}h)`)
          return false
        }

        // Vérifier si les données ont changé par rapport au dernier backup
        const hasChanged = await this.hasDataChanged(newData)
        if (!hasChanged) {
          console.log(`[AutoBackup] Auto backup skipped - data unchanged`)
          return false
        }
      }
      // Pour logout/error/manual : TOUJOURS créer le backup, pas de vérification

      const timestamp = Date.now()
      const filename = `backup_${timestamp}.json`
      const filepath = `${this.backupDir}${filename}`

      const backupData: BackupData = {
        version: 1,
        timestamp,
        trigger,
        data: newData
      }

      // Serialize en JSON
      const json = JSON.stringify(backupData, null, 2)

      // Écrire le fichier
      await FileSystem.writeAsStringAsync(filepath, json, {
        encoding: FileSystem.EncodingType.UTF8
      })

      // Vérifier l'intégrité (peut lire le fichier)
      const verification = await FileSystem.readAsStringAsync(filepath)
      JSON.parse(verification) // Throw si JSON invalide

      // Mettre à jour le timestamp du dernier auto backup si c'est un auto backup
      if (trigger === 'auto') {
        this.lastAutoBackupTime = timestamp
      }

      console.log(`[AutoBackup] Backup created: ${filename} (trigger: ${trigger})`)

      // Nettoyer les anciens backups
      await this.cleanOldBackups()

      return true
    } catch (error) {
      console.error('[AutoBackup] Failed to create backup:', error)
      Sentry.captureException(error, {
        tags: { feature: 'auto_backup', action: 'create', trigger },
        extra: { userId: state.user.id }
      })
      return false
    }
  }

  /**
   * Vérifie si les données ont changé par rapport au dernier backup
   */
  private async hasDataChanged(newData: any): Promise<boolean> {
    try {
      // Récupérer le dernier backup
      const backups = await this.listBackups()
      if (backups.length === 0) {
        // Pas de backup existant, donc données forcément différentes
        return true
      }

      // Lire le dernier backup
      const latestBackup = backups[0]
      const backupContent = await FileSystem.readAsStringAsync(latestBackup.filepath)
      const backupData: BackupData = JSON.parse(backupContent)

      // Comparer les données (stringify pour comparaison profonde)
      const newDataJson = JSON.stringify(newData)
      const oldDataJson = JSON.stringify(backupData.data)

      return newDataJson !== oldDataJson
    } catch (error) {
      console.error('[AutoBackup] Failed to check data changes:', error)
      // En cas d'erreur, on crée le backup par sécurité
      return true
    }
  }

  /**
   * Nettoie les anciens backups (garde les MAX_BACKUPS plus récents)
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.backupDir)

      // Filtre seulement les fichiers backup
      const backupFiles = files
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse() // Plus récents en premier

      // Supprime les backups en trop
      if (backupFiles.length > this.MAX_BACKUPS) {
        const toDelete = backupFiles.slice(this.MAX_BACKUPS)

        for (const file of toDelete) {
          await FileSystem.deleteAsync(`${this.backupDir}${file}`, { idempotent: true })
          console.log(`[AutoBackup] Deleted old backup: ${file}`)
        }
      }
    } catch (error) {
      console.error('[AutoBackup] Failed to clean old backups:', error)
      // Non critique, on continue
    }
  }

  /**
   * Liste tous les backups disponibles
   */
  async listBackups(): Promise<BackupInfo[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const files = await FileSystem.readDirectoryAsync(this.backupDir)

      const backupFiles = files
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse()

      const backups: BackupInfo[] = []

      for (const file of backupFiles) {
        const filepath = `${this.backupDir}${file}`
        const info = await FileSystem.getInfoAsync(filepath)

        if (info.exists) {
          // Extraire le timestamp du nom de fichier
          const timestamp = parseInt(file.replace('backup_', '').replace('.json', ''))

          // Calculer les statistiques en lisant le backup
          let stats: { notesCount: number; highlightsCount: number; studiesCount: number } | undefined
          try {
            const json = await FileSystem.readAsStringAsync(filepath)
            const backup: BackupData = JSON.parse(json)

            stats = {
              notesCount: Object.keys(backup.data?.bible?.notes || {}).length,
              highlightsCount: Object.keys(backup.data?.bible?.highlights || {}).length,
              studiesCount: Object.keys(backup.data?.studies || {}).length
            }
          } catch (error) {
            console.warn(`[AutoBackup] Failed to read stats for ${file}:`, error)
            // stats reste undefined en cas d'erreur
          }

          backups.push({
            filename: file,
            filepath,
            timestamp,
            size: info.size || 0,
            modificationTime: info.modificationTime || 0,
            stats
          })
        }
      }

      return backups
    } catch (error) {
      console.error('[AutoBackup] Failed to list backups:', error)
      return []
    }
  }

  /**
   * Restaure un backup spécifique
   * @returns Les données du backup ou null si erreur
   */
  async restoreBackup(filename: string): Promise<BackupData | null> {
    try {
      const filepath = `${this.backupDir}${filename}`
      const json = await FileSystem.readAsStringAsync(filepath)
      const backup: BackupData = JSON.parse(json)

      // Validation basique
      if (!backup.data || !backup.data.bible) {
        throw new Error('Invalid backup format')
      }

      console.log(`[AutoBackup] Backup restored: ${filename}`)
      return backup
    } catch (error) {
      console.error('[AutoBackup] Failed to restore backup:', error)
      Sentry.captureException(error, {
        tags: { feature: 'auto_backup', action: 'restore' },
        extra: { filename }
      })
      return null
    }
  }

  /**
   * Supprime tous les backups
   */
  async clearAllBackups(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.backupDir, { idempotent: true })
      await this.initialize() // Recrée le dossier
      console.log('[AutoBackup] All backups cleared')
    } catch (error) {
      console.error('[AutoBackup] Failed to clear backups:', error)
    }
  }

  /**
   * Get le timestamp du dernier auto backup
   */
  getLastAutoBackupTime(): number {
    return this.lastAutoBackupTime
  }
}

// Types

export type BackupTrigger =
  | 'auto'           // Backup automatique (debounced)
  | 'logout'         // Avant déconnexion
  | 'sync_error'     // Après erreur de sync
  | 'manual'         // Déclenché manuellement par l'utilisateur

export interface BackupData {
  version: number
  timestamp: number
  trigger: BackupTrigger
  data: {
    bible: any
    plan: any
    studies: any
  }
}

export interface BackupInfo {
  filename: string
  filepath: string
  timestamp: number
  size: number
  modificationTime: number
  stats?: {
    notesCount: number
    highlightsCount: number
    studiesCount: number
  }
}

// Export singleton
export const autoBackupManager = new AutoBackupManager()
