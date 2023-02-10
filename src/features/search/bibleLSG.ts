let data: any = null

const bibleLSG = {
  get() {
    return data
  },

  set(newData: any) {
    data = newData
  },
}

export default bibleLSG
