import { useMemo } from 'react'

const HOUR_HEIGHT = 60 // px per hour
const HOURS = Array.from({ length: 9 }, (_, i) => i + 9) // 9 AM to 5 PM

const getLocalDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CalendarGrid({ interviews = [] }) {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }, [])

  const interviewsByDay = useMemo(() => {
    const map = {}
    interviews.forEach((interview) => {
      const dateKey = getLocalDateKey(interview.start)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(interview)
    })
    return map
  }, [interviews])

  const isToday = (date) => {
    const t = new Date()
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear()
  }

  return (
    <div className="glass-card overflow-hidden" id="calendar-grid">
      {/* Day Headers */}
      <div className="grid grid-cols-8 border-b border-surface-700/30">
        <div className="p-3 text-surface-500 text-xs font-medium">Time</div>
        {weekDays.map((day, idx) => (
          <div key={idx} className={`p-3 text-center border-l border-surface-700/30 ${isToday(day) ? 'bg-primary-500/5' : ''}`}>
            <p className="text-surface-500 text-xs font-medium uppercase">
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
            <p className={`text-lg font-bold ${isToday(day) ? 'text-primary-400' : 'text-surface-200'}`}>
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-8 relative" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
        {/* Time labels */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute w-full px-3 text-right text-surface-500 text-xs"
              style={{ top: (hour - 9) * HOUR_HEIGHT }}
            >
              {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, dayIdx) => {
          const dateKey = getLocalDateKey(day)
          const dayInterviews = interviewsByDay[dateKey] || []

          return (
            <div key={dayIdx} className={`relative border-l border-surface-700/30 ${isToday(day) ? 'bg-primary-500/3' : ''}`}>
              {/* Hour grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-t border-surface-700/15"
                  style={{ top: (hour - 9) * HOUR_HEIGHT }}
                />
              ))}

              {/* Interview Events */}
              {dayInterviews.map((interview) => {
                const hour = interview.start.getHours()
                const minutes = interview.start.getMinutes()
                const top = (hour - 9) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT

                return (
                  <div
                    key={interview.id}
                    className="absolute left-1 right-1 bg-primary-500/20 border border-primary-500/40 rounded-lg p-2 cursor-pointer hover:bg-primary-500/30 transition-colors overflow-hidden"
                    style={{ top, height: HOUR_HEIGHT - 4 }}
                    title={`${interview.title} - Score: ${interview.compositeScore}`}
                  >
                    <p className="text-primary-300 text-xs font-semibold truncate">{interview.title}</p>
                    <p className="text-primary-400/70 text-xs font-mono">
                      {interview.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
