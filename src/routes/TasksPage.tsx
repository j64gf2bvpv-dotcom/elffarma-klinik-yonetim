import * as React from 'react'
import { format, isPast, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Link } from 'react-router-dom'
import { CheckSquare, Trash2, User } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useTasks, useUpdateTask, useDeleteTask } from '@/features/tasks/hooks'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n/tr'
import type { TaskStatus } from '@/types/database'
import type { TaskWithRelations } from '@/features/tasks/api'

const statuses: TaskStatus[] = ['bekliyor', 'devam_ediyor', 'tamamlandi', 'iptal']

const priorityBadgeClass: Record<string, string> = {
  dusuk: 'bg-muted text-muted-foreground',
  normal: 'bg-primary/10 text-primary',
  yuksek: 'bg-destructive/15 text-destructive',
}

function TaskCard({ task }: { task: TaskWithRelations }) {
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const overdue =
    task.status !== 'tamamlandi' &&
    task.status !== 'iptal' &&
    task.due_date != null &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date))

  return (
    <div className={cn('rounded-lg border p-2.5 text-sm', overdue && 'border-destructive/30 bg-destructive/5')}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-medium">{task.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <TaskForm task={task} />
          <Button variant="ghost" size="icon" className="size-6" onClick={() => deleteMutation.mutate(task.id)}>
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      </div>
      {task.customers && (
        <Link to={`/musteriler/${task.customer_id}`} className="text-muted-foreground text-xs hover:underline">
          {task.customers.full_name}
        </Link>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn('border-transparent text-[10px]', priorityBadgeClass[task.priority])}>
          {tr.taskPriority[task.priority]}
        </Badge>
        {task.assignee && (
          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <User className="size-3" /> {task.assignee.full_name}
          </span>
        )}
        {task.due_date && (
          <span className={cn('text-[11px]', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {format(new Date(task.due_date), 'd MMM yyyy', { locale: trLocale })}
          </span>
        )}
      </div>
      <Select
        value={task.status}
        onValueChange={(value) => updateMutation.mutate({ id: task.id, input: { status: value as TaskStatus } })}
      >
        <SelectTrigger className="mt-2 h-7 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {tr.taskStatus[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TasksPage() {
  const { staff } = useAuth()
  const [onlyMine, setOnlyMine] = React.useState(false)
  const { data: tasks = [] } = useTasks()

  const visibleTasks = onlyMine ? tasks.filter((t) => t.assigned_to === staff?.id) : tasks

  return (
    <div>
      <PageHeader
        title="Görevler"
        description="Personele atanabilen, durum ve öncelik taşıyan iş takibi"
        actions={
          <div className="flex gap-2">
            <Button variant={onlyMine ? 'default' : 'outline'} onClick={() => setOnlyMine((v) => !v)}>
              <User /> Bana Atananlar
            </Button>
            <TaskForm />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {statuses.map((status) => {
          const columnTasks = visibleTasks.filter((t) => t.status === status)
          return (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  {tr.taskStatus[status]}
                  <Badge variant="outline">{columnTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {columnTasks.length === 0 && (
                  <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    <CheckSquare className="size-3.5" /> Görev yok
                  </p>
                )}
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
