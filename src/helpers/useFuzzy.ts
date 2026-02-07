import Fuse from 'fuse.js'
import { useEffect, useState } from 'react'

function removeAccents(obj: any) {
  if (typeof obj === 'string' || obj instanceof String) {
    return obj.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  return obj
}

function getFn(obj: any, path: any) {
  // @ts-ignore
  let value = Fuse.config.getFn(obj, path)
  if (Array.isArray(value)) {
    return value.map(el => el)
  }
  return removeAccents(value)
}

export type IFuzzyClient<T> = {
  keyword: string
  result: T[]
  resetSearch: () => void
  search: (keyword: string) => void
}

function useFuzzy<T>(
  data: T[],
  options: Fuse.IFuseOptions<T>,
  defaultValue?: string
): IFuzzyClient<T> {
  const [keyword, setKeyword] = useState('')
  const resetSearch = () => setKeyword('')

  useEffect(() => {
    setKeyword(defaultValue || '')
  }, [defaultValue])

  const defaultOptions: Fuse.IFuseOptions<T> = {
    threshold: 0,
    ignoreFieldNorm: true,
  }
  const searcher = new Fuse(data, { ...defaultOptions, ...options, getFn })

  const result = keyword ? searcher.search(removeAccents(keyword)).map(c => c.item) : data

  return {
    keyword,
    resetSearch,
    result,
    search: setKeyword,
  }
}

export default useFuzzy
