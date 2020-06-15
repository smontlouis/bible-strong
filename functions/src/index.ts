const admin = require('firebase-admin')
admin.initializeApp()

export { grec } from './grec'
export { hebreu } from './hebreu'
export { dictionnaire } from './dictionnaire'
export { count_verses } from './count_verses'
export { iaphub } from './iaphub'
export { buildStudy, exportStudyPDF, deleteStudy } from './studies'
