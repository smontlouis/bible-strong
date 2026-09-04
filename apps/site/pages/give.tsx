import { useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DonationStep } from '../features/give/DonationStep'
import { RadioButton } from '../features/give/RadioButton'
import GiveENAudibible from '../features/give/give-en-audibible.mdx'
import GiveEN from '../features/give/give-en.mdx'
import GiveFRAudibible from '../features/give/give-fr-audibible.mdx'
import GiveFR from '../features/give/give-fr.mdx'
import { useCurrentLocale, useI18n } from '../locales'

type DonationMode = 'one-time' | 'monthly'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { 'buy-button-id': string; 'publishable-key': string }
    }
  }
}

const amounts: Record<DonationMode, string[]> = { 'one-time': ['10', '20', '50', '100'], monthly: ['2', '5', '10', '20'] }
const monthlyButtons: Record<string, React.ReactNode> = {
  '2': <stripe-buy-button buy-button-id="buy_btn_1Oh95TFT207ftn8WHBmj2N6F" publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY" />,
  '5': <stripe-buy-button buy-button-id="buy_btn_1Oh6CBFT207ftn8WJyjBCGFV" publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY" />,
  '10': <stripe-buy-button buy-button-id="buy_btn_1Oi1LIFT207ftn8W3GZCLTz8" publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY" />,
  '20': <stripe-buy-button buy-button-id="buy_btn_1Oh6UmFT207ftn8WutQu8ytz" publishable-key="pk_live_51Oh4w1FT207ftn8WhxKQPUHz8XFyLFU8lv2Tm6h77n3EpTKUw0U3dm0qBIT50Kv3SMJ6teKNPfgxKrx6VjscM1Xu00yq9viPYY" />,
}

export default function GivePage() {
  const search = useSearch({ strict: false }) as { p?: string }
  const isAudibible = search.p === 'audibible'
  const [mode, setMode] = useState<DonationMode>('one-time')
  const [amount, setAmount] = useState('10')
  const [freeAmount, setFreeAmount] = useState('')
  const locale = useCurrentLocale()
  const t = useI18n()

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/buy-button.js'
    script.async = true
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [])

  const donationLink = useMemo(() => `https://donate.stripe.com/cN27v9a3y4EZ0SI148?__prefilled_amount=${Number(amount || freeAmount || 0) * 100}`, [amount, freeAmount])
  const chooseMode = (next: DonationMode) => { setMode(next); setAmount(next === 'one-time' ? '10' : '2') }

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex basis-1/2 bg-[#fcfcfc]">
        <div className="top-0 flex flex-1 items-center justify-center lg:sticky lg:h-screen lg:justify-end">
          <div className="mx-10 flex max-w-[380px] flex-col gap-10 py-10 [counter-reset:donation-steps] lg:mx-20">
            <a href={isAudibible ? 'https://audibible.app' : '/'}><img src={isAudibible ? '/images/svg/logo-full-audibible.svg' : '/images/svg/logo-full.svg'} className="h-[52px] w-60" alt="Bible Strong" /></a>
            <DonationStep label={t('donate.step1')}>
              <div className="flex" onChange={(event) => chooseMode((event.target as HTMLInputElement).value as DonationMode)}>
                <RadioButton name="donationMode" value="one-time" checked={mode === 'one-time'} onChange={() => undefined} label={t('one-time')} />
                <RadioButton name="donationMode" value="monthly" checked={mode === 'monthly'} onChange={() => undefined} label={t('monthly')} />
              </div>
            </DonationStep>
            <DonationStep label={t('donate.step2')}>
              <div className="flex flex-col gap-2 lg:flex-row">
                <div className="flex" onFocus={() => setFreeAmount('')}>
                  {amounts[mode].map((value) => <RadioButton key={value} name="amount" value={value} checked={amount === value} onChange={() => setAmount(value)} label={`${value}€`} />)}
                </div>
                {mode === 'one-time' && <Input className="w-[120px] font-semibold" type="number" placeholder={t('free')} onFocus={() => setAmount('')} value={freeAmount} onChange={(event) => setFreeAmount(event.target.value)} />}
              </div>
            </DonationStep>
            {mode === 'one-time' ? <Button asChild><a href={donationLink}>{t('donate')}</a></Button> : amount && <div className="h-[359px] w-72">{monthlyButtons[amount]}</div>}
          </div>
        </div>
      </section>
      <section className="flex basis-1/2 items-start justify-center shadow-[-15px_0_30px_rgba(0,0,0,.18)]">
        <div className="mx-10 flex max-w-[380px] flex-col gap-3 py-10 lg:mx-20 lg:py-20">
          {locale === 'fr' ? (isAudibible ? <GiveFRAudibible /> : <GiveFR />) : (isAudibible ? <GiveENAudibible /> : <GiveEN />)}
        </div>
      </section>
    </main>
  )
}
