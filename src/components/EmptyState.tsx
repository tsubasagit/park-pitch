interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span className="text-5xl">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-6 py-2 bg-pitch-navy text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
