import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Home,
  LogOut,
  UserRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

const lessons = [
  { number: 1, state: 'done' },
  { number: 2, state: 'done' },
  { number: 3, state: 'done' },
  { number: 4, state: 'done' },
  { number: 5, state: 'done' },
  { number: 6, state: 'done' },
  { number: 7, state: 'current' },
]

export default function StudentHome({ profile }: { profile: Profile }) {
  const firstName = profile.name?.trim().split(' ')[0] || 'Aluno'

  return (
    <main className="studentPage">
      <header className="studentHeader">
        <div className="studentBrand">
          <img src="/logo-rv.png" className="headerLogo" alt="RV Fisiologia" />
          <span>RV Fisiologia</span>
        </div>

        <button className="iconButton" onClick={() => supabase.auth.signOut()} aria-label="Sair">
          <LogOut size={18} />
        </button>
      </header>

      <section className="studentHero">
        <div>
          <p className="eyebrow">SEU ACOMPANHAMENTO</p>
          <h1>Olá, {firstName}.</h1>
          <p className="muted">Acompanhe o programa e continue de onde parou.</p>
        </div>

        <div className="heroDate">
          <CalendarDays size={17} />
          Semana 1 de 2
        </div>
      </section>

      <section className="studentGrid">
        <article className="programMainCard">
          <div className="programCardTop">
            <div>
              <span className="miniLabel">PROGRAMA ATUAL</span>
              <h2>Emagrecimento — 14 aulas</h2>
            </div>
            <strong>43%</strong>
          </div>

          <div className="progressBar" aria-label="43% concluído">
            <span style={{ width: '43%' }} />
          </div>
          <p className="muted smallText">6 de 14 aulas concluídas</p>

          <button className="primary programAction">
            Continuar treino
            <ChevronRight size={18} />
          </button>
        </article>

        <article className="nextLessonCard">
          <span className="miniLabel">PRÓXIMA AULA</span>
          <div className="nextLessonInfo">
            <div>
              <h2>Aula 07</h2>
              <p className="muted">Treino completo · 34 min</p>
            </div>
            <span className="lessonNumber">07</span>
          </div>
          <button className="secondary wideButton">Ver aula</button>
        </article>
      </section>

      <section className="lessonsSection">
        <div className="sectionHeading">
          <div>
            <span className="miniLabel">SEMANA 1</span>
            <h2>Suas aulas</h2>
          </div>
          <button className="plainButton">Ver programa completo</button>
        </div>

        <div className="lessonList">
          {lessons.map((lesson) => (
            <button
              key={lesson.number}
              className={`lessonItem ${lesson.state === 'current' ? 'current' : ''}`}
            >
              <div className="lessonIndex">{String(lesson.number).padStart(2, '0')}</div>
              <div className="lessonCopy">
                <strong>Aula {String(lesson.number).padStart(2, '0')}</strong>
                <span>{lesson.state === 'done' ? 'Concluída' : 'Próxima aula'}</span>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <nav className="bottomNav" aria-label="Navegação do aluno">
        <a className="active"><Home size={18} /><span>Início</span></a>
        <a><BookOpen size={18} /><span>Programa</span></a>
        <a><ChartNoAxesColumnIncreasing size={18} /><span>Evolução</span></a>
        <a><UserRound size={18} /><span>Perfil</span></a>
      </nav>
    </main>
  )
}
