import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './landing.css'

export function LandingPage() {
  useEffect(() => {
    const track = document.getElementById('tickerTrack')
    if (!track) return
    const bar = track.parentElement
    if (!bar) return
    const pause = () => { track.style.animationPlayState = 'paused' }
    const play = () => { track.style.animationPlayState = 'running' }
    bar.addEventListener('mouseenter', pause)
    bar.addEventListener('mouseleave', play)
    return () => {
      bar.removeEventListener('mouseenter', pause)
      bar.removeEventListener('mouseleave', play)
    }
  }, [])

  return (
    <div className="landing-root">
      <header>
        <nav>
          <div className="logo">
            <svg className="mark" viewBox="0 0 24 24" fill="none">
              <path d="M3 18L8 11L13 15L21 5" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 5H15" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 5V11" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Lici<b>trend</b>
          </div>
          <div className="nav-links">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#calendario">Calendário</a>
            <a href="#etapas">Etapas</a>
            <a href="#planos">Planos</a>
          </div>
          <div className="nav-cta">
            <Link to="/login" className="btn btn-ghost">Entrar</Link>
            <Link to="/register" className="btn btn-primary">Quero me cadastrar</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Monitoramento de editais</span>
              <h1>Chegue na <em>frente</em>.</h1>
              <h2 className="sub">Você não compete com o edital. Compete com quem chegou nele primeiro.</h2>
              <p className="lead">O Licitrend monitora o que importa pra você, avisa com som assim que sai algo novo e separa o que é novidade do que você já viu. Sem ficar de olho em portal.</p>
              <div className="hero-ctas">
                <Link to="/register" className="btn btn-primary btn-lg">Quero me cadastrar</Link>
                <a href="#como-funciona" className="btn btn-ghost btn-lg">Ver como funciona</a>
              </div>
            </div>
            <div className="hero-panel">
              <div className="hero-panel-head">
                <span>Radar ativo · 14 dias restantes</span>
                <div className="hp-live">
                  <div className="sound-wave"><span></span><span></span><span></span><span></span></div>
                  <span className="pulse-dot"></span>
                </div>
              </div>
              <div className="panel-line">
                <div><span className="pl-name">PE 045/2026 — Prefeitura de Curitiba</span><span className="pl-sub">TI · publicado agora</span></div>
                <span className="tag novo">🔔 NOVO</span>
              </div>
              <div className="panel-line">
                <div><span className="pl-name">DISPENSA 112/26 — SES-DF</span><span className="pl-sub">Saúde · favoritado</span></div>
                <span className="tag visto">JÁ VISTO</span>
              </div>
              <div className="panel-line">
                <div><span className="pl-name">CONCORRÊNCIA 009/2026 — DETRAN-MG</span><span className="pl-sub">Serviços · arquivado</span></div>
                <span className="tag visto">JÁ VISTO</span>
              </div>
              <div className="panel-line">
                <div><span className="pl-name">PE 332/2026 — Secretaria de Fazenda</span><span className="pl-sub">GED/ECM · publicado agora</span></div>
                <span className="tag novo">🔔 NOVO</span>
              </div>
            </div>
          </div>
        </section>

        <div className="ticker-bar">
          <div className="ticker-track" id="tickerTrack">
            <span className="ticker-item"><b>PE 045/2026</b> · Prefeitura de Curitiba · TI <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>DISPENSA 112/26</b> · SES-DF · Saúde <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>CONCORRÊNCIA 009/2026</b> · DETRAN-MG · Serviços <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>PE 00231/2026</b> · TJ-GO · Jurídico <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>PE 087/2026</b> · Hospital Municipal · Saúde <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>PE 2026-0159</b> · Universidade Federal · Educação <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>TOMADA DE PREÇOS</b> · Prefeitura de Manaus · Engenharia <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>PE 332/2026</b> · Secretaria de Fazenda · GED/ECM <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>PE 045/2026</b> · Prefeitura de Curitiba · TI <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>DISPENSA 112/26</b> · SES-DF · Saúde <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>CONCORRÊNCIA 009/2026</b> · DETRAN-MG · Serviços <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>PE 00231/2026</b> · TJ-GO · Jurídico <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>PE 087/2026</b> · Hospital Municipal · Saúde <span className="flag-visto">JÁ VISTO</span></span>
            <span className="ticker-item"><b>PE 2026-0159</b> · Universidade Federal · Educação <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>TOMADA DE PREÇOS</b> · Prefeitura de Manaus · Engenharia <span className="flag-novo">🔔 NOVO</span></span>
            <span className="ticker-item"><b>PE 332/2026</b> · Secretaria de Fazenda · GED/ECM <span className="flag-visto">JÁ VISTO</span></span>
          </div>
        </div>

        <section id="humano">
          <div className="wrap photo-split">
            <div className="photo-frame">
              <img src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1200&q=80" alt="Pessoa concentrada trabalhando no notebook" />
            </div>
            <div>
              <span className="eyebrow">Por trás do alerta</span>
              <blockquote>Gente decide. Oferecemos a estrutura e o ambiente.</blockquote>
              <p>Acreditamos que quem analisa edital todo dia já tem o preparo e a experiência. Por isso, nosso papel é simples: ser a melhor ferramenta e estrutura pra esse profissional — entregando mais agilidade, de um jeito mais orgânico e intuitivo pra rotina de quem tá na ponta.</p>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section>
          <div className="wrap">
            <div className="stats">
              <div className="stat"><div className="num">100%</div><div className="label">das novidades com som</div></div>
              <div className="stat"><div className="num">&lt; 1 min</div><div className="label">do edital ao seu alerta</div></div>
              <div className="stat"><div className="num">0</div><div className="label">editais repetidos te confundindo</div></div>
              <div className="stat"><div className="num">4</div><div className="label">etapas até o resultado</div></div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="como-funciona">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Como funciona</span>
              <h2>Edital saiu, você já sabe.</h2>
              <p>Sem ficar de olho em portal nenhum. O Licitrend avisa — você só entra na hora de decidir.</p>
            </div>
            <div className="steps">
              <div className="step">
                <span className="step-no">01</span>
                <h3>Tempo determinado</h3>
                <p>Monitore os portais no intervalo que você escolher — 1, 5 ou 30 minutos. Nosso radar varre o mercado em tempo real e traz a oportunidade mais rápido. Chegue na frente.</p>
                <div className="step-line"></div>
              </div>
              <div className="step">
                <span className="step-no">02</span>
                <h3>Som na hora</h3>
                <p>Saiu edital novo, toca um som. Mesmo com o sistema em segundo plano.</p>
                <div className="step-line"></div>
              </div>
              <div className="step">
                <span className="step-no">03</span>
                <h3>Você no controle</h3>
                <p>Favorita, arquiva, joga no calendário, move de etapa. A decisão é sua.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="recursos">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Recursos</span>
              <h2>O que te coloca na frente.</h2>
            </div>
            <div className="features-grid">
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#C9B6FF" strokeWidth="1.6"/><path d="m20 20-3.6-3.6" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Busca em todas as fontes</h3>
                <p>Pesquisa PNCP e ComprasGov ao mesmo tempo. Uma busca, tudo junto.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M6 12h12M10 18h4" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Filtros que importam</h3>
                <p>UF, esfera, CAPAG do município, órgão e palavras negativas. Só o que interessa.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#C9B6FF" strokeWidth="1.6"/><path d="M12 7v5l3.5 2" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Radar por tempo determinado</h3>
                <p>Define o intervalo do radar. Ele varre sozinho e desliga quando acabar.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M9 18V8a3 3 0 0 1 6 0v10" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/><path d="M5 14a7 7 0 0 0 14 0" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 21v-3" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Alerta sonoro</h3>
                <p>Edital novo, toque na hora — e notificação no desktop, mesmo com o app fechado.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="12" r="2" fill="#FF7A59"/><circle cx="16" cy="12" r="2" fill="#6E6390"/></svg>
                <h3>Novo vs. já visto</h3>
                <p>Chega marcado: o que é novidade e o que você já conferiu.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="#C9B6FF" strokeWidth="1.6"/><path d="M8 2v4M16 2v4M3 9h18" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round"/><path d="m9 15 2 2 4-4" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <h3>Prazos legais no automático</h3>
                <p>Impugnação, recurso e contrarrazão em dias úteis, com os feriados das 27 UFs.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Alerta de prazo</h3>
                <p>O sino avisa quando a impugnação ou a sessão estão chegando. Um clique leva ao card.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M12 17.3 6.2 20l1.1-6.5L2.5 9l6.6-1L12 2l2.9 6 6.6 1-4.8 4.5 1.1 6.5z" stroke="#C9B6FF" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                <h3>Favoritos + calendário</h3>
                <p>Favoritou, virou prazo no calendário. Automático.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M3 21h18" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/><path d="M5 21V7l8-4v18" stroke="#FF7A59" strokeWidth="1.6" strokeLinejoin="round"/><path d="M19 21V11l-6-3.5" stroke="#FF7A59" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 9v.01M9 13v.01M9 17v.01" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Análise de concorrentes</h3>
                <p>Digite o CNPJ e veja o histórico de disputas e os setores onde ele atua.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="5" height="14" rx="1" stroke="#C9B6FF" strokeWidth="1.6"/><rect x="9.5" y="5" width="5" height="9" rx="1" stroke="#C9B6FF" strokeWidth="1.6"/><rect x="16" y="5" width="5" height="5" rx="1" stroke="#C9B6FF" strokeWidth="1.6"/></svg>
                <h3>Etapas da licitação</h3>
                <p>Triagem, análise, proposta, resultado. Com o time, tudo visível.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M4 19V5a1 1 0 0 1 1-1h10l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" stroke="#FF7A59" strokeWidth="1.6"/><path d="M8 13h8M8 16h5" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Análise estratégica</h3>
                <p>Risco, exigência e histórico do órgão, antes de entrar.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M12 3v12" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round"/><path d="m7 10 5 5 5-5" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 21h14" stroke="#C9B6FF" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3>Exporte pra onde quiser</h3>
                <p>Resultados em Excel; agenda de prazos em .ics pro Google, Outlook ou Apple.</p>
              </div>
              <div className="feature">
                <svg className="ficon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 7l1 12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1l1-12M4 7l1-3h14l1 3" stroke="#FF7A59" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <h3>Arquive</h3>
                <p>Tira do radar sem apagar o histórico.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="calendario">
          <div className="wrap cal-wrap">
            <div>
              <span className="eyebrow">Calendário inteligente</span>
              <h2 style={{marginTop:'14px', fontSize:'clamp(24px,3vw,34px)'}}>Cada favorito, no dia certo.</h2>
              <p style={{marginTop:'14px', fontSize:'16px'}}>Favoritou, o Licitrend já marca o prazo no calendário. Abre o mês e vê exatamente o que tá chegando — e o que tá prestes a encerrar.</p>
              <div className="cal-legend">
                <span><span className="leg-dot" style={{background:'var(--coral)'}}></span> Favoritado</span>
                <span><span className="leg-dot" style={{background:'var(--violet-soft)'}}></span> Em acompanhamento</span>
              </div>
            </div>
            <div className="cal-card">
              <div className="cal-head">
                <span>Julho 2026</span>
                <span>4 prazos este mês</span>
              </div>
              <div className="cal-grid">
                <div className="cal-dow">D</div><div className="cal-dow">S</div><div className="cal-dow">T</div><div className="cal-dow">Q</div><div className="cal-dow">Q</div><div className="cal-dow">S</div><div className="cal-dow">S</div>
                <div className="cal-cell empty"></div><div className="cal-cell empty"></div><div className="cal-cell">1</div><div className="cal-cell">2</div><div className="cal-cell">3</div><div className="cal-cell track">4<span className="dot"></span></div><div className="cal-cell">5</div>
                <div className="cal-cell">6</div><div className="cal-cell">7</div><div className="cal-cell">8</div><div className="cal-cell fav">9<span className="dot"></span></div><div className="cal-cell">10</div><div className="cal-cell">11</div><div className="cal-cell">12</div>
                <div className="cal-cell">13</div><div className="cal-cell track">14<span className="dot"></span></div><div className="cal-cell">15</div><div className="cal-cell">16</div><div className="cal-cell">17</div><div className="cal-cell">18</div><div className="cal-cell">19</div>
                <div className="cal-cell">20</div><div className="cal-cell">21</div><div className="cal-cell">22</div><div className="cal-cell fav">23<span className="dot"></span></div><div className="cal-cell">24</div><div className="cal-cell">25</div><div className="cal-cell">26</div>
                <div className="cal-cell">27</div><div className="cal-cell">28</div><div className="cal-cell">29</div><div className="cal-cell">30</div><div className="cal-cell">31</div><div className="cal-cell empty"></div><div className="cal-cell empty"></div>
              </div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="etapas">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Gestão de etapas</span>
              <h2>Acompanhe até o resultado.</h2>
              <p>Veja em que pé tá cada licitação, de relance. Trabalhe com o seu time, compartilhe — ou não — cada acompanhamento, e receba alertas das movimentações importantes.</p>
            </div>
            <div className="photo-banner photo-frame">
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80" alt="Equipe acompanhando o andamento das licitações juntos" />
              <span className="caption">Sua equipe, sempre alinhada sobre onde cada licitação está.</span>
            </div>
            <div className="kanban">
              <div className="kan-col">
                <h4>Triagem <span>2</span></h4>
                <div className="kan-card">PE 045/2026<span>Prefeitura de Curitiba</span></div>
                <div className="kan-card">DISPENSA 112/26<span>SES-DF</span></div>
              </div>
              <div className="kan-col">
                <h4>Em análise <span>2</span></h4>
                <div className="kan-card">PE 00231/2026<span>TJ-GO</span></div>
                <div className="kan-card">PE 332/2026<span>Secretaria de Fazenda</span></div>
              </div>
              <div className="kan-col">
                <h4>Proposta enviada <span>1</span></h4>
                <div className="kan-card">PE 087/2026<span>Hospital Municipal</span></div>
              </div>
              <div className="kan-col">
                <h4>Resultado <span>1</span></h4>
                <div className="kan-card">CONCORRÊNCIA 009/2026<span>DETRAN-MG · vencida</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="planos">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Planos</span>
              <h2>Comece sozinho. Cresça com o time.</h2>
              <p>Sem letra miúda: cadastro liberado pra Básico e Equipe. Pra operação maior, a gente conversa.</p>
            </div>
            <div className="pricing-grid">
              <div className="price-card">
                <h3>Básico</h3>
                <div className="price-tag">R$ 80<span>/mês</span></div>
                <p className="price-desc">Pra quem monitora sozinho.</p>
                <ul className="price-list">
                  <li>Varredura a cada 30 minutos</li>
                  <li>Alerta sonoro de novidade</li>
                  <li>Favoritos e calendário inteligente</li>
                  <li>Arquivamento de oportunidades</li>
                  <li>1 usuário</li>
                </ul>
                <Link to="/register?plano=basico" className="btn btn-ghost">Quero me cadastrar</Link>
              </div>
              <div className="price-card popular">
                <span className="price-badge">Mais usado</span>
                <h3>Equipe</h3>
                <div className="price-tag">R$ 240<span>/mês</span></div>
                <p className="price-desc">Pra quem decide em grupo.</p>
                <ul className="price-list">
                  <li>Varredura a cada 5 minutos</li>
                  <li>Tudo do plano Básico</li>
                  <li>Etapas da licitação compartilhadas</li>
                  <li>Compartilhe — ou não — cada acompanhamento</li>
                  <li>Análise estratégica</li>
                  <li>Até 5 usuários</li>
                </ul>
                <Link to="/register?plano=equipe" className="btn btn-primary">Quero me cadastrar</Link>
              </div>
              <div className="price-card">
                <h3>Enterprise</h3>
                <div className="price-tag">Sob consulta</div>
                <p className="price-desc">Pra operação com volume e regras próprias.</p>
                <ul className="price-list">
                  <li>Varredura a cada 1 minuto</li>
                  <li>Tudo do plano Equipe</li>
                  <li>Usuários ilimitados</li>
                  <li>Integrações personalizadas</li>
                  <li>Suporte dedicado</li>
                </ul>
                <a href="mailto:licitrend@gmail.com" className="btn btn-ghost">Falar com vendas</a>
              </div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="cta">
          <div className="wrap">
            <div className="cta-banner">
              <span className="eyebrow">Comece agora</span>
              <h2>Pronto pra chegar na frente?</h2>
              <p>Crie sua conta e comece a monitorar em minutos.</p>
              <div className="hero-ctas">
                <Link to="/register" className="btn btn-primary btn-lg">Quero me cadastrar</Link>
                <a href="mailto:licitrend@gmail.com" className="btn btn-ghost btn-lg">Falar com o time</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="footer-grid">
            <div className="logo">
              <svg className="mark" viewBox="0 0 24 24" fill="none">
                <path d="M3 18L8 11L13 15L21 5" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 5H15" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 5V11" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Lici<b>trend</b>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Produto</h4>
                <a href="#como-funciona">Como funciona</a>
                <a href="#recursos">Recursos</a>
                <a href="#calendario">Calendário</a>
                <a href="#etapas">Etapas</a>
              </div>
              <div className="footer-col">
                <h4>Contato</h4>
                <span>licitrend@gmail.com</span>
                <span>Brasília · DF</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Licitrend. Todos os direitos reservados.</span>
            <span>Chegue na frente.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
