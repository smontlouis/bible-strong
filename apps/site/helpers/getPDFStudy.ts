import slugify from 'slugify'

const getPDFStudy = async (id: string, title: string) => {
  const response = await fetch(
    `https://us-central1-bible-strong-app.cloudfunctions.net/exportStudyPDF`,
    {
      body: JSON.stringify({ studyId: id }),
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  )

  const buffer = await response.arrayBuffer()

  const blob = new Blob([buffer], { type: 'application/pdf' })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = `${slugify(title)}.pdf`
  link.click()
}

export default getPDFStudy
