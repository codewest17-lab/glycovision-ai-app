import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'

const SLIDES = [
  {
    title: 'See the sugar inside your food',
    body: 'Snap a photo of any meal and get an instant AI-powered sugar and nutrition breakdown.',
    icon: 'photo_camera',
  },
  {
    title: 'Understand what you\u2019re really eating',
    body: 'Calories, carbs, protein, fat, fiber, and a clear health summary — no guesswork.',
    icon: 'monitoring',
  },
  {
    title: 'Track your progress over time',
    body: 'Every scan is saved to your history, so you can spot patterns and make better choices.',
    icon: 'trending_up',
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const isLast = step === SLIDES.length - 1

  const next = () => {
    if (isLast) {
      navigate('/auth')
    } else {
      setStep((s) => s + 1)
    }
  }

  const skip = () => navigate('/auth')

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col">
      <div className="flex justify-end p-6">
        {!isLast && (
          <button
            onClick={skip}
            className="text-sm text-gray-500 font-medium"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-8">
          <Icon name={SLIDES[step].icon} size={40} className="text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {SLIDES[step].title}
        </h1>
        <p className="text-gray-500 leading-relaxed max-w-xs">
          {SLIDES[step].body}
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-8">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === step ? 'w-6 bg-brand-600' : 'w-2 bg-brand-200'
            }`}
          />
        ))}
      </div>

      <div className="px-6 pb-10">
        <button
          onClick={next}
          className="w-full bg-brand-600 text-white font-semibold rounded-2xl py-4 shadow-sm active:bg-brand-700 transition-colors"
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  )
}
