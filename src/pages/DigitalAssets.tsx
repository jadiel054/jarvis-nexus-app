import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { DigitalAsset } from '@/types/jarvis'

export default function DigitalAssets() {
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('digital_assets').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setAssets((data as DigitalAsset[]) || []); setLoading(false) })
  }, [])

  const totalInvested = assets.reduce((s, a) => s + (a.paidPrice || 0), 0)
  const totalRevenue = assets.reduce((s, a) => s + a.monthlyRevenue, 0)
  const avgScore = assets.length > 0 ? assets.reduce((s, a) => s + (a.score || 0), 0) / assets.length : 0

  return (
    <div className="min-h-screen bg-[#050a0f] text-[#E0F7FA] p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono font-bold text-[#00FFFF] text-lg">DASHBOARD DE ATIVOS DIGITAIS</h1>
          <p className="font-mono text-xs text-[#37474F]">JARVIS NEXUS // ASSET INTELLIGENCE v1.0</p>
        </div>
        <button className="flex items-center gap-2 border border-[#00FFFF]/40 rounded px-3 py-2 font-mono text-sm text-[#00FFFF] min-h-[44px] hover:bg-[#00FFFF]/10">
          <Plus size={16} /> Adicionar Ativo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Total Ativos', value: String(assets.length), color: 'text-[#00FFFF]' },
          { label: 'Score Médio', value: avgScore.toFixed(1), color: 'text-purple-400' },
          { label: 'Investido', value: `R$${totalInvested.toFixed(0)}`, color: 'text-[#FFD700]' },
          { label: 'Receita/mês', value: `R$${totalRevenue.toFixed(0)}`, color: 'text-[#00FF88]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d2030] border border-[#00FFFF]/10 rounded-lg p-4 text-center">
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
            <div className="text-xs font-mono text-[#37474F] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-center font-mono text-[#37474F]">Carregando...</p>
      ) : assets.length === 0 ? (
        <p className="text-center font-mono text-[#37474F] py-8">
          Nenhum ativo encontrado. Adicione seu primeiro ativo digital!
        </p>
      ) : (
        <div className="space-y-3">
          {assets.map(asset => (
            <div key={asset.id} className="bg-[#0d2030] border border-[#00FFFF]/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono font-bold text-[#E0F7FA]">{asset.name}</h3>
                  {asset.url && <p className="font-mono text-xs text-[#37474F]">{asset.url}</p>}
                </div>
                <div className="text-right">
                  {asset.score && <div className="font-mono font-bold text-[#FFD700]">{asset.score}<span className="text-xs text-[#37474F]">/10</span></div>}
                  {asset.askingPrice > 0 && <div className="font-mono text-xs text-[#37474F]">R$ {asset.askingPrice}</div>}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs border border-[#37474F]/30 text-[#37474F] px-2 py-0.5 rounded font-mono">{asset.type}</span>
                <span className={`text-xs border px-2 py-0.5 rounded font-mono ${
                  asset.status === 'approved' ? 'border-[#00FF88]/40 text-[#00FF88]' :
                  asset.status === 'purchased' ? 'border-[#00FFFF]/40 text-[#00FFFF]' :
                  'border-[#37474F]/30 text-[#37474F]'
                }`}>{asset.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
