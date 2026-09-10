"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Globe, MoreHorizontal } from "lucide-react";
import { useState } from "react";

const originalOrder = ["Code", "File", "More"];

interface ProjectTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ProjectTabs({
  activeTab,
  setActiveTab,
}: ProjectTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const handlePreview = () => {
    setSelected([]);
    setActiveTab("preview");
  };

  const handleSelect = (item: string) => {
    const index = originalOrder.indexOf(item);

    setSelected(originalOrder.slice(0, index + 1));

    if (item === "Code") {
      setActiveTab("code");
    }
  };

  return (
    <div className="h-14 border-b border-white/10 flex items-center justify-start px-4 bg-[#0a0a0a]">

      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 30,
        }}
        className="relative flex items-center rounded-full border border-blue-500/40 bg-blue-600/10 p-1 backdrop-blur-md"
      >

        {/* Preview */}
        <motion.button
          layout
          whileTap={{ scale: 0.95 }}
          onClick={handlePreview}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium ${
            activeTab === "preview"
              ? "text-white"
              : "text-blue-400"
          }`}
        >
          <Globe size={16} />
          Preview
        </motion.button>


        {/* Selected tabs */}
        <AnimatePresence mode="popLayout">
          {selected.map((item) => (
            <motion.button
              key={item}
              layout
              initial={{
                opacity: 0,
                x: -15,
                scale: 0.8,
              }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                x: -15,
                scale: 0.8,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              onClick={() => handleSelect(item)}
              whileTap={{
                scale: 0.95,
              }}
              className="ml-2 rounded-full px-4 py-2 text-sm text-white hover:bg-blue-500/20"
            >
              {item}
            </motion.button>
          ))}
        </AnimatePresence>


        <div className="mx-2 h-5 w-px bg-blue-500/30" />


        {/* Menu */}
        <div className="relative">

          <motion.button
            whileTap={{ scale: 0.9 }}
            animate={{
              rotate: menuOpen ? 90 : 0,
            }}
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-full p-2 text-blue-400 hover:bg-blue-500/20 hover:text-white"
          >
            <MoreHorizontal size={18}/>
          </motion.button>


          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{
                  opacity:0,
                  y:-10,
                  scale:0.95,
                }}
                animate={{
                  opacity:1,
                  y:0,
                  scale:1,
                }}
                exit={{
                  opacity:0,
                  y:-10,
                  scale:0.95,
                }}
                className="absolute left-0 mt-2 w-44 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl"
              >

                {originalOrder.map((item,index)=>(
                  <motion.button
                    key={item}
                    initial={{
                      opacity:0,
                      x:-10
                    }}
                    animate={{
                      opacity:1,
                      x:0
                    }}
                    transition={{
                      delay:index * 0.05
                    }}
                    onClick={()=>{
                      handleSelect(item);
                      setMenuOpen(false);
                    }}
                    className="flex w-full px-4 py-3 text-sm text-neutral-300 hover:bg-blue-500/10"
                  >
                    {item}
                  </motion.button>
                ))}

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </motion.div>

    </div>
  );
}