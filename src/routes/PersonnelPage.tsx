import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShieldAlert } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { useAuth } from '@/lib/auth'
import { usePersonnel, usePersonnelDocuments } from '@/features/personnel/hooks'
import { PersonnelFormDialog } from '@/features/personnel/PersonnelFormDialog'
import { PersonPhoto } from '@/features/personnel/PersonPhoto'
import { docSummary, isActivePerson, trDate } from '@/features/personnel/status'
import type { Personnel } from '@/types/database'

/** Personel Özlük Dosyası — liste (kullanıcı isteği, 2026-11-12). Sadece yöneticiler. */
export function PersonnelPage() {
  const { staff } = useAuth()
  const navigate = useNavigate()
  const { data: people = [], isLoading } = usePersonnel()
  const { data: docs = [] } = usePersonnelDocuments()
  const [query, setQuery] = React.useState('')
  const [tab, setTab] = React.useState<'active' | 'left' | 'all'>('active')

  if (staff && staff.role !== 'admin') {
    return (
      <div>
        <PageHeader title="Personel Özlük Dosyası" />
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <ShieldAlert className="size-5" /> Bu bölümü sadece yöneticiler görebilir.
          </CardContent>
        </Card>
      </div>
    )
  }

  const docsOf = (id: string) => docs.filter((d) => d.personnel_id === id)
  const q = query.trim().toLocaleLowerCase('tr-TR')
  const rows = people
    .filter((p) => (tab === 'all' ? true : tab === 'active' ? isActivePerson(p) : !isActivePerson(p)))
    .filter((p) => !q || [p.full_name, p.position, p.department, p.phone, p.tc_no].some((v) => v?.toLocaleLowerCase('tr-TR').includes(q)))

  return (
    <div>
      <PageHeader
        title="Personel Özlük Dosyası"
        description="Çalışanların kimlik, iletişim ve iş bilgileri ile özlük evrakları"
        actions={
          <div className="flex gap-2">
            <ExportMenu<Personnel>
              title="Personel Listesi"
              filename="personel-listesi"
              rows={rows}
              columns={[
                { header: 'Adı Soyadı', value: (p) => p.full_name },
                { header: 'T.C. Kimlik No', value: (p) => p.tc_no ?? '' },
                { header: 'Görevi', value: (p) => p.position ?? '' },
                { header: 'Birimi', value: (p) => p.department ?? '' },
                { header: 'Telefon', value: (p) => p.phone ?? '' },
                { header: 'E-posta', value: (p) => p.email ?? '' },
                { header: 'Doğum Tarihi', value: (p) => trDate(p.birth_date) },
                { header: 'İşe Giriş', value: (p) => trDate(p.start_date) },
                { header: 'İşten Çıkış', value: (p) => trDate(p.end_date) },
                { header: 'SGK Sicil No', value: (p) => p.sgk_no ?? '' },
                { header: 'IBAN', value: (p) => p.iban ?? '' },
                { header: 'Kan Grubu', value: (p) => p.blood_type ?? '' },
                { header: 'Adres', value: (p) => p.address ?? '' },
                {
                  header: 'Eksik Evraklar',
                  value: (p) =>
                    docSummary(docsOf(p.id))
                      .missing.map((m) => m.label)
                      .join(', '),
                },
              ]}
            />
            <PersonnelFormDialog />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="active">Çalışanlar</TabsTrigger>
            <TabsTrigger value="left">Ayrılanlar</TabsTrigger>
            <TabsTrigger value="all">Tümü</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="İsim, görev, telefon ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>Adı Soyadı</TableHead>
                <TableHead>Görevi</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>İşe Giriş</TableHead>
                <TableHead>Evraklar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {people.length === 0 ? 'Henüz personel eklenmedi — sağ üstten "Personel Ekle".' : 'Aramaya uyan personel yok.'}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((p) => {
                const s = docSummary(docsOf(p.id))
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/personel/${p.id}`)}>
                    <TableCell>
                      <PersonPhoto path={p.photo_path} className="size-10" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.full_name}
                      {!isActivePerson(p) && (
                        <Badge variant="outline" className="ml-2">
                          Ayrıldı
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{[p.position, p.department].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="tabular-nums">{p.phone ?? '—'}</TableCell>
                    <TableCell>{trDate(p.start_date) || '—'}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums">
                          {s.done}/{s.total}
                        </span>
                        {s.missing.length > 0 && <Badge variant="outline">{s.missing.length} eksik</Badge>}
                        {s.expired.length > 0 && <Badge variant="destructive">{s.expired.length} süresi dolmuş</Badge>}
                        {s.soon.length > 0 && (
                          <Badge variant="outline" className="border-amber-500/60 text-amber-600">
                            {s.soon.length} süresi yaklaşıyor
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
