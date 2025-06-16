
import { Link, useLocation } from 'react-router-dom';
import { IconContext } from 'react-icons';

export default function SidebarButton(props) {
    const location = useLocation();
    const isActive = location.pathname === props.to;
  
    return (
      <Link to={props.to} className="no-underline">
        <div
          className={`h-20 w-20 rounded-[20px] flex items-center justify-center flex-col mx-auto my-[5px] transition-all duration-200
            ${
              isActive
                ? "bg-[#7B9CFF] text-[#222B45] scale-105"
                : "bg-transparent text-white hover:text-[#F3F6FB]"
            }`}
        >
          <IconContext.Provider value={{ size: "24px" }}>
            {props.icon}
            <p className="mx-auto my-1 font-semibold text-sm">{props.title}</p>
          </IconContext.Provider>
        </div>
      </Link>
    );
  }