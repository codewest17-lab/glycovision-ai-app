import Icon from '../components/Icon'

export default function CheckEmail() {
  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-6">
        <Icon name="mail" size={32} className="text-brand-600" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
      <p className="text-gray-500 max-w-xs">
        We sent you a confirmation link. Tap it to activate your account, then come back and sign in.
      </p>
    </div>
  )
}
