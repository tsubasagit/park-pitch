interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = '読み込み中...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-10 h-10 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
