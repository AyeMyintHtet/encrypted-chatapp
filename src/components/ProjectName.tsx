"use client"
import Image from "next/image"

export default function ProjectName() {
  return (
    <div className="flex flex-col justify-center items-center mb-5">

      <p
        className="text-4xl sm:text-[50px] font-bold tracking-widest uppercase bg-clip-text text-transparent bg-linear-to-r from-[#09637E] to-[#0a9396] self-center"
        style={{ fontFamily: "var(--font-roboto-slab), 'Courier New', serif" }}
      >
        CQgram
      </p>
      <Image
        src="/logoo.png"
        alt="CQgram — Secure Encrypted Chat"
        width={140}
        height={140}
        priority
        fetchPriority="high"
        className="drop-shadow-[0_0_20px_rgba(9,99,126,0.4)] cursor-pointer transition-transform duration-500 hover:scale-110"
      />


    </div>
  )
}