import React from 'react';
import { motion } from 'framer-motion';

interface RevealSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const RevealSection: React.FC<RevealSectionProps> = ({ children, delay = 0, className, style, id }) => {
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default RevealSection;