import { QueueSkeleton } from '@/components/Skeletons'

/** Черга. Сюди ж потрапляє все, у чого немає власного `loading.tsx`. */
export default function Loading() {
  return <QueueSkeleton />
}
