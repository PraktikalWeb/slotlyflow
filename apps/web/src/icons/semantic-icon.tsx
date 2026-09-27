import {
  faAddressBook,
  faArrowLeft,
  faArrowRight,
  faArrowRightFromBracket,
  faArrowUpRightFromSquare,
  faBell,
  faBolt,
  faBuilding,
  faCalendar,
  faChartLine,
  faChartSimple,
  faCheck,
  faCheckDouble,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleExclamation,
  faCircleQuestion,
  faCircleXmark,
  faClock,
  faCreditCard,
  faDatabase,
  faDownload,
  faEllipsis,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFaceSmile,
  faFileInvoice,
  faFileLines,
  faFilter,
  faGauge,
  faGear,
  faHouse,
  faKey,
  faLaptop,
  faMessage,
  faMicrophone,
  faMobileScreenButton,
  faPaperclip,
  faPen,
  faPhone,
  faPlug,
  faPlus,
  faRobot,
  faRotateRight,
  faSearch,
  faShieldHalved,
  faSpinner,
  faTriangleExclamation,
  faUpload,
  faUser,
  faUserPlus,
  faUsers,
  faVideo,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import * as React from 'react';

import whatsappBusinessAppIcon from '../../public/brand/whatsapp-business-app.jpg';

export type SemanticIconConcept =
  | 'organization'
  | 'overview'
  | 'conversations'
  | 'contacts'
  | 'automations'
  | 'settings'
  | 'profile'
  | 'team'
  | 'whatsappConnection'
  | 'whatsappBusiness'
  | 'help'
  | 'logout'
  | 'back'
  | 'collapseSidebar'
  | 'expandSidebar'
  | 'passwordVisible'
  | 'passwordHidden'
  | 'email'
  | 'alert'
  | 'arrowRight'
  | 'success'
  | 'check'
  | 'laptop'
  | 'smartphone'
  | 'upload'
  | 'chevronDown'
  | 'passwordShow'
  | 'passwordHide'
  | 'mail'
  | 'close'
  | 'clock'
  | 'error'
  | 'chevronUp'
  | 'chart'
  | 'shield'
  | 'creditCard'
  | 'search'
  | 'filter'
  | 'plus'
  | 'bell'
  | 'loader'
  | 'menuVertical'
  | 'menuHorizontal'
  | 'edit'
  | 'warning'
  | 'arrowUpRight'
  | 'dashboard'
  | 'activity'
  | 'audit'
  | 'download'
  | 'refresh'
  | 'video'
  | 'phone'
  | 'checkDouble'
  | 'smile'
  | 'attachment'
  | 'microphone'
  | 'userPlus'
  | 'chevronRight'
  | 'bot'
  | 'calendar'
  | 'shieldCheck'
  | 'receipt'
  | 'key'
  | 'database'
  | 'bot';

/** Current WhatsApp Business brand asset supplied for SlotlyFlow. */
export const whatsappBusinessIconAsset = { kind: 'whatsapp-business-brand-asset' } as const;
type SemanticIconDefinition = IconDefinition | typeof whatsappBusinessIconAsset;

export const semanticIconMap: Readonly<Record<SemanticIconConcept, SemanticIconDefinition>> = {
  organization: faBuilding,
  overview: faHouse,
  conversations: faMessage,
  contacts: faAddressBook,
  automations: faBolt,
  settings: faGear,
  profile: faUser,
  team: faUsers,
  whatsappConnection: faPlug,
  whatsappBusiness: whatsappBusinessIconAsset,
  help: faCircleQuestion,
  logout: faArrowRightFromBracket,
  back: faArrowLeft,
  collapseSidebar: faChevronLeft,
  expandSidebar: faChevronRight,
  passwordVisible: faEye,
  passwordHidden: faEyeSlash,
  email: faEnvelope,
  alert: faCircleExclamation,
  arrowRight: faArrowRight,
  success: faCircleCheck,
  check: faCheck,
  laptop: faLaptop,
  smartphone: faMobileScreenButton,
  upload: faUpload,
  chevronDown: faChevronDown,
  passwordShow: faEye,
  passwordHide: faEyeSlash,
  close: faXmark,
  clock: faClock,
  error: faCircleXmark,
  chevronUp: faChevronUp,
  chart: faChartSimple,
  shield: faShieldHalved,
  creditCard: faCreditCard,
  search: faSearch,
  filter: faFilter,
  plus: faPlus,
  bell: faBell,
  loader: faSpinner,
  menuVertical: faEllipsisVertical,
  menuHorizontal: faEllipsis,
  edit: faPen,
  warning: faTriangleExclamation,
  arrowUpRight: faArrowUpRightFromSquare,
  dashboard: faGauge,
  activity: faChartLine,
  audit: faFileLines,
  receipt: faFileInvoice,
  download: faDownload,
  calendar: faCalendar,
  shieldCheck: faShieldHalved,
  userPlus: faUserPlus,
  bot: faRobot,
  refresh: faRotateRight,
  video: faVideo,
  checkDouble: faCheckDouble,
  smile: faFaceSmile,
  attachment: faPaperclip,
  microphone: faMicrophone,
  key: faKey,
  database: faDatabase,
  phone: faPhone,
  chevronRight: faChevronRight,
  mail: faEnvelope,
};

export type SemanticIconSize = 'navigation' | 'control' | 'metadata' | 'feature';

export const semanticIconSizes: Readonly<Record<SemanticIconSize, string>> = {
  navigation: 'var(--icon-size-small)',
  control: 'var(--icon-size-medium)',
  metadata: 'var(--font-size-xs)',
  feature: 'var(--icon-size-large)',
};

interface SemanticIconProps {
  readonly concept: SemanticIconConcept;
  readonly size?: SemanticIconSize;
  readonly className?: string;
}

/** Decorative icon primitive. Interactive controls provide their own accessible name. */
export function SemanticIcon({ concept, size = 'control', className }: SemanticIconProps) {
  const icon = semanticIconMap[concept];
  const iconSize = semanticIconSizes[size];
  if (icon === whatsappBusinessIconAsset) {
    return <Image aria-hidden="true" className={className} src={whatsappBusinessAppIcon} alt="" style={{ height: iconSize, width: iconSize }} />;
  }

  return <FontAwesomeIcon aria-hidden="true" className={className} icon={icon as IconDefinition} style={{ fontSize: iconSize }} />;
}



