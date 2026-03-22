'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { AllocationData, Category } from '@/lib/types'
import { categoryColor, formatValue } from '@/lib/utils'

interface Props { data: AllocationData; onCategorySelect: (cat: Category) => void }

const CustomCell = (props: any) => {
  const { x, y, width, height, category, onClick } = props
  if (width < 4 || height < 4) return null
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={width} height={height}
        fill={categoryColor(category)} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 60 && height > 24 &&
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={12} fontWeight={600}>{props.label}</text>}
    </g>
  )
}

export default function AllocationTreemap({ data, onCategorySelect }: Props) {
  const treeData = data.categories.map(c => ({
    name: c.label, size: c.value, category: c.category,
  }))
  return (
    <div data-testid="allocation-treemap" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treeData}
          dataKey="size"
          aspectRatio={4 / 3}
          content={<CustomCell onClick={(c: any) => onCategorySelect(c.category)} />}
        >
          <Tooltip formatter={(v: number) => formatValue(v, data.displayCurrency)} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
