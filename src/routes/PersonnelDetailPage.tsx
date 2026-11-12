import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Plus, FileImage, FileText } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { confirmAction } from '@/hooks/useConfirmDialog'
import { isPdfPath, openDocument } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import { useDeletePersonnel, useDeletePersonnelDocument, usePersonnel, usePersonnelDocuments } from '@/features/personnel/hooks'
import { PersonnelFormDialog } from '@/features/personnel/PersonnelFormDialog'
import { PersonnelDocumentDialog } from '@/features/personnel/PersonnelDocumentDialog'
import { PersonPhoto } from '@/features/personnel/PersonPhoto'
import { PERSONNEL_DOC_TYPES, docTypeLabel } from '@/features/personnel/docTypes'
import { docSummary, isActivePerson, trDate, validity } from '@/features/personnel/status'
import type { Personnel, PersonnelDocument } from '@/types/database'

const INFO: { title: string; rows: [keyof Personnel, string][] }[] = [
  {
    title: 'Kimlik',
    rows: [
      ['tc_no', 'T.C. Kimlik No'],
      ['birth_date', 'Doğum Tarihi'],
      ['birth_place', 'Doğum Yeri'],
      ['gender', 'Cinsiyeti'],
      ['marital_status', 'Medeni Hâli'],
      ['blood_type', 'Kan Grubu'],
    ],
  },
  {
    title: 'İletişim',
    rows: [
      ['phone', 'Telefon'],
      ['email', 'E-posta'],
      ['address', 'Adres'],
      ['emergency_contact_name', 'Acil Durum Kişisi'],
      ['emergency_contact_phone', 'Acil Durum Telefonu'],
    ],
  },
  {
    title: 'İş',
    rows: [
      ['position', 'Görevi'],
      ['department', 'Birimi'],
      ['start_date', 'İşe Giriş'],
      ['end_date', 'İşten Çıkış'],
      ['sgk_no', 'SGK Sicil No'],
      ['iban', 'IBAN'],
    ],
  },
  {
    title: 'Diğer',
    rows: [
      ['education', 'Eğitim'],
      ['military_status', 'Askerlik'],
      ['license_class', 'Ehliyet Sınıfı'],
      ['notes', 'Notlar'],
    ],
  },
]

const DATE_FIELDS = new Set<keyof Personnel>(['birth_date', 'start_date', 'end_date'])

type DocRow = { key: string; label: string; doc?: PersonnelDocument }

/** Personel özlük dosyası — bilgiler + evrak kontrol listesi (2026-11-12) */
export function PersonnelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: people = [], isLoading } = usePersonnel()
  const { data: docs = [] } = usePersonnelDocuments(id)
  const removePerson = useDeletePersonnel()
  const removeDoc = useDeletePersonnelDocument()
  const person = people.find((p) => p.id === id)

  if (!person) {
    return (
      <div>
        <PageHeader title="Personel Özlük Dosyası" />
        <Card>
          <CardContent className="p-6 text-muted-foreground">{isLoading ? 'Yükleniyor...' : 'Personel bulunamadı.'}</CardContent>
        </Card>
      </div>
    )
  }

  // Standart evraklar sırayla (yoksa "Eksik" satırı), sonra "Diğer" evraklar
  const rows: DocRow[] = [
    ...PERSONNEL_DOC_TYPES.flatMap((t): DocRow[] => {
      const list = docs.filter((d) => d.doc_type === t.key)
      return list.length ? list.map((doc) => ({ key: doc.id, label: t.label, doc })) : [{ key: t.key, label: t.label }]
    }),
    ...docs.filter((d) => !PERSONNEL_DOC_TYPES.some((t) => t.key === d.doc_type)).map((doc) => ({ key: doc.id, label: docTypeLabel(doc.doc_type, doc.title), doc })),
  ]
  const s = docSummary(docs)

  async function handleDeletePerson() {
    if (!person) return
    if (!(await confirmAction(`${person.full_name} ve bütün evrakları kalıcı olarak silinsin mi?`))) return
    await removePerson.mutateAsync({ person, docs })
    navigate('/personel')
  }

  async function handleDeleteDoc(doc: PersonnelDocument) {
    if (!(await confirmAction(`"${docTypeLabel(doc.doc_type, doc.title)}" evrakı silinsin mi?`))) return
    removeDoc.mutate(doc)
  }

  async function openFile(path: string, title: string) {
    try {
      await openDocument(path, title)
    } catch (err) {
      toast.error('Dosya açılamadı', { description: getErrorMessage(err) })
    }
  }

  return (
    <div>
      <PageHeader
        title={person.full_name}
        description={[person.position, person.department].filter(Boolean).join(' · ') || 'Personel Özlük Dosyası'}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportMenu<DocRow>
              title={`${person.full_name} — Özlük Evrakları`}
              filename={`ozluk-${person.full_name.replace(/\s+/g, '-').toLocaleLowerCase('tr-TR')}`}
              rows={rows}
              columns={[
                { header: 'Evrak', value: (r) => r.label },
                { header: 'Durum', value: (r) => (!r.doc ? 'Eksik' : validity(r.doc) === 'expired' ? 'Süresi dolmuş' : 'Var') },
                { header: 'Belge Tarihi', value: (r) => trDate(r.doc?.document_date) },
                { header: 'Geçerlilik', value: (r) => trDate(r.doc?.valid_until) },
                { header: 'Not', value: (r) => r.doc?.note ?? '' },
              ]}
            />
            <PersonnelFormDialog
              person={person}
              trigger={
                <Button variant="outline">
                  <Pencil /> Bilgileri Düzenle
                </Button>
              }
            />
            <Button variant="outline" onClick={() => void handleDeletePerson()}>
              <Trash2 className="text-destructive" /> Sil
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <div className="flex items-center gap-3">
              <PersonPhoto path={person.photo_path} className="size-20" />
              <div>
                <p className="font-semibold">{person.full_name}</p>
                <Badge variant={isActivePerson(person) ? 'outline' : 'secondary'}>{isActivePerson(person) ? 'Çalışıyor' : 'Ayrıldı'}</Badge>
              </div>
            </div>
            {INFO.map((sec) => {
              const filled = sec.rows.filter(([k]) => person[k])
              if (!filled.length) return null
              return (
                <div key={sec.title} className="grid gap-1.5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{sec.title}</p>
                  {filled.map(([k, label]) => (
                    <div key={k} className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="break-words">{DATE_FIELDS.has(k) ? trDate(person[k] as string) : String(person[k])}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Evraklar{' '}
              <span className="text-sm font-normal text-muted-foreground">
                {s.done}/{s.total} tamam{s.missing.length ? ` · ${s.missing.length} eksik` : ''}
                {s.expired.length ? ` · ${s.expired.length} süresi dolmuş` : ''}
              </span>
            </CardTitle>
            <PersonnelDocumentDialog
              personnelId={person.id}
              trigger={
                <Button size="sm">
                  <Plus /> Evrak Ekle
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evrak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Belge Tarihi</TableHead>
                  <TableHead>Geçerlilik</TableHead>
                  <TableHead>Dosya</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const v = r.doc ? validity(r.doc) : undefined
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">
                        {r.label}
                        {r.doc?.note && <span className="block text-xs font-normal text-muted-foreground">{r.doc.note}</span>}
                      </TableCell>
                      <TableCell>
                        {!r.doc ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            Eksik
                          </Badge>
                        ) : v === 'expired' ? (
                          <Badge variant="destructive">Süresi dolmuş</Badge>
                        ) : v === 'soon' ? (
                          <Badge variant="outline" className="border-amber-500/60 text-amber-600">
                            Süresi yaklaşıyor
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                            Var
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{trDate(r.doc?.document_date) || '—'}</TableCell>
                      <TableCell>{trDate(r.doc?.valid_until) || '—'}</TableCell>
                      <TableCell>
                        {r.doc?.attachment_paths.length ? (
                          <span className="flex flex-wrap gap-1">
                            {r.doc.attachment_paths.map((p, i) => (
                              <Button
                                key={p}
                                variant="outline"
                                size="icon"
                                className="size-7"
                                title="Açmak için tıklayın"
                                onClick={() => void openFile(p, `${person.full_name} ${r.label} ${i + 1}`)}
                              >
                                {isPdfPath(p) ? <FileText className="size-3.5" /> : <FileImage className="size-3.5" />}
                              </Button>
                            ))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.doc ? (
                          <>
                            <PersonnelDocumentDialog
                              personnelId={person.id}
                              doc={r.doc}
                              trigger={
                                <Button variant="ghost" size="icon" title="Düzenle">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                            />
                            <Button variant="ghost" size="icon" title="Sil" onClick={() => void handleDeleteDoc(r.doc!)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <PersonnelDocumentDialog
                            personnelId={person.id}
                            defaultType={r.key}
                            trigger={
                              <Button variant="outline" size="sm">
                                <Plus className="size-3.5" /> Ekle
                              </Button>
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
