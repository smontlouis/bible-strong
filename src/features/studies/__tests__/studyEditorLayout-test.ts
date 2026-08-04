import { getStudyEditorBottomInset } from '../studyEditorLayout'

describe('getStudyEditorBottomInset', () => {
  it('keeps the form-sheet editor above the keyboard and its toolbar', () => {
    expect(
      getStudyEditorBottomInset({
        isFormSheet: true,
        footerVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(370)
  })

  it('only reserves the toolbar when the keyboard is closed', () => {
    expect(
      getStudyEditorBottomInset({
        isFormSheet: true,
        footerVisible: true,
        keyboardHeight: 0,
      })
    ).toBe(50)
  })

  it('leaves non-form-sheet keyboard avoidance to KeyboardAvoidingView', () => {
    expect(
      getStudyEditorBottomInset({
        isFormSheet: false,
        footerVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(0)
  })
})
