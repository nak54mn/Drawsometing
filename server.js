// 你畫我猜 Draw & Guess - 即時多人遊戲
// 跑法: npm install && node server.js  -> 開 http://localhost:3000
// 需要 Node 18+

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const OpenCC = require('opencc-js'); // 簡繁正規化

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ---- 簡繁轉換: 一律轉成簡體當作比對基準 (繁->簡, 簡保持) ----
const toSimp = OpenCC.Converter({ from: 'tw', to: 'cn' });
function normalize(s) {
  if (!s) return '';
  // 去空白、標點、轉小寫、繁轉簡
  const cleaned = String(s).trim().toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  try { return toSimp(cleaned); } catch { return cleaned; }
}

// ---- 預設詞庫 (依難度) ----
const DEFAULT_WORDS = {
  簡單: [
    '貓','狗','豬','牛','羊','馬','雞','鴨','鵝','兔子','老鼠','大象',
    '獅子','老虎','熊','猴子','鹿','斑馬','長頸鹿','河馬','犀牛','袋鼠','無尾熊','熊貓',
    '狐狸','狼','松鼠','刺蝟','蝙蝠','青蛙','烏龜','蛇','鱷魚','蜥蜴','魚','鯊魚',
    '鯨魚','海豚','章魚','螃蟹','蝦','貝殼','海星','水母','海馬','企鵝','鴿子','麻雀',
    '貓頭鷹','老鷹','孔雀','鸚鵡','火雞','蝴蝶','蜜蜂','蜻蜓','螞蟻','蜘蛛','瓢蟲','蚊子',
    '蒼蠅','毛毛蟲','蝸牛','蚯蚓','蘋果','香蕉','橘子','葡萄','西瓜','草莓','鳳梨','芒果',
    '水蜜桃','櫻桃','檸檬','奇異果','哈密瓜','木瓜','椰子','荔枝','龍眼','蓮霧','芭樂','火龍果',
    '番茄','紅蘿蔔','白蘿蔔','馬鈴薯','地瓜','玉米','南瓜','茄子','青椒','洋蔥','大蒜','薑',
    '香菇','花椰菜','高麗菜','菠菜','青江菜','豌豆','黃瓜','苦瓜','麵包','蛋糕','餅乾','甜甜圈',
    '漢堡','薯條','披薩','熱狗','三明治','壽司','飯糰','便當','火鍋','麵','餃子','包子',
    '饅頭','蛋','牛奶','起司','冰淇淋','巧克力','糖果','棒棒糖','爆米花','布丁','果凍','蜂蜜',
    '咖啡','茶','果汁','汽水','啤酒','紅酒','水','珍珠奶茶','太陽','月亮','星星','雲',
    '雨','雪','彩虹','閃電','風','火','水滴','山','河','海','湖','樹',
    '花','草','葉子','仙人掌','蘑菇','石頭','沙灘','島嶼','火山','瀑布','森林','沙漠',
    '冰山','汽車','公車','卡車','摩托車','腳踏車','火車','飛機','船','帆船','潛水艇','火箭',
    '太空船','直升機','熱氣球','救護車','消防車','警車','計程車','推土機','挖土機','三輪車','雪橇','滑板',
    '輪椅','房子','城堡','帳篷','橋','燈塔','風車','教堂','摩天大樓','煙囪','門','窗戶',
    '樓梯','屋頂','圍牆','信箱','路燈','紅綠燈','噴泉','鞦韆','溜滑梯','蹺蹺板','桌子','椅子',
    '沙發','床','衣櫃','書架','檯燈','時鐘','鏡子','地毯','窗簾','枕頭','棉被','電視',
    '冰箱','洗衣機','微波爐','電風扇','冷氣','吹風機','電話','電腦','鍵盤','滑鼠','耳機','相機',
    '杯子','碗','盤子','筷子','湯匙','叉子','刀子','鍋子','水壺','茶壺','牙刷','牙膏',
    '肥皂','毛巾','雨傘','帽子','眼鏡','手錶','戒指','項鍊','皮包','錢包','鑰匙','雨衣',
    '手套','圍巾','襪子','鞋子','拖鞋','靴子','裙子','褲子','襯衫','外套','帽T','鉛筆',
    '原子筆','橡皮擦','尺','剪刀','膠水','書','筆記本','書包','蠟筆','畫筆','調色盤','地球儀',
    '黑板','粉筆','釘書機','迴紋針','信封','郵票','氣球','風箏','陀螺','積木','拼圖','娃娃',
    '玩具車','足球','籃球','棒球','網球','羽毛球','桌球','保齡球','撞球','飛鏢','鋼琴','吉他',
    '小提琴','大提琴','鼓','喇叭','笛子','口琴','麥克風','手機','平板','燈泡','電池','插頭',
    '雨鞋','安全帽','口罩','OK繃','體溫計','針筒','聽診器','輪胎','方向盤','螺絲','鐵鎚','鋸子',
    '釘子','螺絲起子','扳手','梯子','水桶','掃把','拖把','畚箕','垃圾桶','心','笑臉','哭臉',
    '星形','愛心','箭頭','皇冠','鑽石','禮物','蠟燭','燈籠','旗子','獎盃','獎牌','鈴鐺',
    '雪人','南瓜燈','聖誕樹','棒球帽','太陽眼鏡','領帶','蝴蝶結','鈕扣','拉鍊','手','腳','眼睛',
    '耳朵','鼻子','嘴巴','牙齒','舌頭','頭髮','手指','拳頭','腳印','骨頭','大腦','心臟',
    '斑馬線','人行道','樓梯間','電梯','手扶梯','旋轉門','自動門','玻璃窗','落地窗','百葉窗','吊燈','壁燈',
    '床頭燈','立燈','燭台','花瓶','盆栽','魚缸','鳥籠','狗屋','貓砂盆','狗鍊','牽繩','飼料碗',
    '項圈','果醬','奶油','吐司','鬆餅','可頌','貝果','蛋塔','馬卡龍','提拉米蘇','起司蛋糕','銅鑼燒',
    '麻糬','紅豆餅','雞蛋糕','車輪餅','蔥油餅','蛋餅','御飯糰','關東煮','滷味','鹹酥雞','雞排','珍珠',
    '仙草','愛玉','豆花','剉冰','雪花冰','糖葫蘆','牛排','豬排','雞腿','香腸','培根','火腿',
    '鮪魚','鮭魚','蝦子','龍蝦','牡蠣','蛤蜊','花枝','魷魚','干貝','鮑魚','海帶','紫菜',
    '豆腐','豆乾','豆漿','米飯','炒飯','炒麵','拉麵','烏龍麵','義大利麵','通心粉','河粉','向日葵',
    '玫瑰','鬱金香','百合','蘭花','茉莉','菊花','牡丹','櫻花','梅花','桃花','杏花','油桐花',
    '薰衣草','滿天星','康乃馨','雛菊','蒲公英','荷花','睡蓮','風信子','三色堇','繡球花','牽牛花','九重葛',
    '松樹','柳樹','楓樹','椰子樹','棕櫚樹','竹子','銀杏','榕樹','橡樹','蘋果樹','櫻桃樹','盆景',
    '多肉植物','蕨類','苔蘚','藤蔓','樹枝','樹根','樹葉','落葉','花苞','花瓣','果實','種子',
    '牙籤','吸管','餐巾','圍兜','砧板','菜刀','鍋鏟','漏勺','量杯','篩子','開罐器','開瓶器',
    '削皮刀','磨刀石','烤箱','電鍋','果汁機','烤麵包機','咖啡機','熱水瓶','保溫瓶','便當盒','保鮮盒','抱枕',
    '床單','被子','毛毯','蚊帳','衣架','曬衣夾','熨斗','燙衣板','縫紉機','針','線','頂針',
    '別針','安全別針','髮夾','髮圈','梳子','指甲剪','棉花棒','化妝棉','排球','壘球','高爾夫球','橄欖球',
    '手球','躲避球','沙灘球','籃框','球門','球網','球拍','球棒','球桿','護目鏡','護膝','護腕',
    '跳繩',
  ],
  普通: [
    '生日派對','結婚典禮','畢業典禮','演唱會','馬戲團','遊樂園','動物園','水族館','博物館','美術館','圖書館','電影院',
    '百貨公司','便利商店','菜市場','夜市','餐廳','咖啡廳','健身房','游泳池','溜冰場','保齡球館','KTV','網咖',
    '加油站','停車場','機場','火車站','公車站','港口','醫院','學校','銀行','郵局','警察局','消防局',
    '廟宇','教堂','寺廟','公園','釣魚','露營','登山','衝浪','潛水','滑雪','跳傘','攀岩',
    '划船','賽跑','跳高','跳遠','游泳','騎馬','拳擊','摔角','跆拳道','柔道','劍道','射箭',
    '舉重','體操','瑜珈','跳舞','唱歌','演奏','畫畫','寫字','攝影','烹飪','烘焙','種花',
    '釣蝦','放風箏','打陀螺','跳繩','踢毽子','捉迷藏','堆雪人','打雪仗','醫生','護士','老師','警察',
    '消防員','廚師','麵包師','服務生','司機','飛行員','太空人','科學家','工程師','程式設計師','律師','法官',
    '會計師','建築師','設計師','畫家','音樂家','歌手','演員','導演','作家','記者','攝影師','農夫',
    '漁夫','獵人','牧羊人','郵差','清潔工','水電工','木匠','鐵匠','理髮師','魔術師','小丑','海盜',
    '騎士','國王','皇后','公主','王子','巫師','忍者','武士','牛仔','礦工','機器人','外星人',
    '恐龍','美人魚','獨角獸','龍','鳳凰','麒麟','精靈','巫婆','吸血鬼','殭屍','木乃伊','幽靈',
    '怪獸','妖怪','雪怪','大腳怪','哥吉拉','超級英雄','電風扇壞掉','水管漏水','塞車','紅燈','停電','火災',
    '地震','颱風','海嘯','下大雨','打雷','起霧','日出','日落','滿月','流星','極光','銀河',
    '黑洞','隕石','生火','露營帳篷','烤肉','野餐','放煙火','點蠟燭','吹蠟燭','切蛋糕','包禮物','拆禮物',
    '寄信','打電話','看電視','玩電腦','滑手機','自拍','排隊','搭電梯','過馬路','等公車','雲霄飛車','摩天輪',
    '旋轉木馬','海盜船','碰碰車','鬼屋','咖啡杯','自由落體','旋轉飛椅','跳樓機','信用卡','鈔票','硬幣','存錢筒',
    '保險箱','計算機','收銀機','發票','帳單','印章','合約','護照','機票','地圖','指南針','望遠鏡',
    '放大鏡','顯微鏡','沙漏','溫度計','體重計','血壓計','鬧鐘','月曆','行事曆','蜘蛛網','蜂巢','鳥巢',
    '蟻窩','蝸牛殼','貝殼','珊瑚','海葵','水母','海膽','燈塔','浮標','漁網','魚鉤','救生圈',
    '救生衣','潛水鏡','蛙鞋','氧氣瓶','衝浪板','金字塔','萬里長城','自由女神像','艾菲爾鐵塔','比薩斜塔','風車','城牆',
    '護城河','吊橋','凱旋門','噴水池','雕像','紀念碑','方尖碑','神社','鳥居','寶塔','涼亭','假山',
    '火車軌道','隧道','山洞','礦坑','水庫','大壩','運河','碼頭','跑道','月台','售票機','驗票閘門',
    '行李箱','推車','安全帶','救生艇','錨','船帆','桅杆','變色龍','樹懶','食蟻獸','穿山甲','鴨嘴獸',
    '水獺','海豹','海象','北極熊','馴鹿','駱駝','羊駝','駝鳥','紅鶴','鵜鶘','啄木鳥','蜂鳥',
    '信天翁','禿鷹','渡鴉','調酒','雞尾酒','紅酒杯','香檳','烈酒','威士忌','雪茄','菸斗','骰子',
    '撲克牌','麻將','西洋棋','圍棋','象棋','跳棋','大富翁','飛行棋','拼字遊戲','賓果','樂透','迷宮',
    '寶藏','藏寶圖','羅盤','古卷軸','魔法書','水晶球','占卜','塔羅牌','星座','星盤','命盤','籤詩',
    '護身符','平安符','許願池','願望清單','時空膠囊','瀑布攀岩','高空彈跳','滑翔翼','熱氣球之旅','環島旅行','背包客','自助旅行',
    '跟團旅遊','郵輪假期','沙漠探險','叢林探險','極地探險','登月','太空漫步','深海探勘','洞穴探險','火山考察','觀星','賞鳥',
    '採蚵','交響樂團','管弦樂','爵士樂','搖滾樂','街頭藝人','卡拉OK','音樂節','樂團','DJ','指揮家','鋼琴家',
    '小提琴手','鼓手','主唱','吉他手','貝斯手','合唱團','啦啦隊','鼓號樂隊','病房','手術房','急診室','候診室',
    '藥局','X光','點滴','輪椅','病床','救護車','擔架','石膏','繃帶','紗布','口罩','防護衣',
    '疫苗','針筒','藥丸','膠囊','藥水','退燒貼','體溫槍','心電圖','法庭','陪審團','證人席','被告',
    '原告','法槌','天秤','手銬','警笛','警棍','盾牌','防彈衣','對講機','巡邏車','偵訊室','監獄',
    '鐵窗','牢房','越獄','通緝令','煙火大會','跨年倒數','燈會','廟會','遶境','舞龍','舞獅','踩高蹺',
    '划龍舟','包粽子','賞月','提燈籠','猜燈謎','發紅包','貼春聯','放鞭炮','守歲','拜年','團圓飯','婚紗照',
    '喜帖','捧花','婚戒','紅毯','證婚','交換誓言','拋捧花','蜜月','求婚','鑽戒','訂婚','聘禮',
    '嫁妝','媒人','伴娘','伴郎','花童','新人','畢業證書','學士帽','撥穗','畢業旗袍','謝師宴','同學會',
    '班遊','校外教學','運動會','園遊會','才藝表演','話劇','朗讀比賽','演講比賽','科展','模範生','班長','風紀股長',
    '升旗','朝會','颱風天','停班停課','淹水','土石流','走山','坍方','斷電','斷水','救災','撤離',
    '避難所','沙包','抽水機','發電機','手電筒','蠟燭','收音機','乾糧','礦泉水','急救包','宇宙飛船','太空站',
    '太空衣','太空食物','失重','月球車','火星探測車','衛星','天文台','流星雨','日食','月食','北斗七星','銀河系',
    '星雲','彗星','小行星','太陽系',
  ],
  困難: [
    '自由','平等','正義','和平','希望','夢想','愛情','友情','親情','信任','背叛','嫉妒',
    '貪婪','驕傲','謙虛','勇敢','懦弱','誠實','謊言','祕密','命運','緣分','輪迴','永恆',
    '瞬間','記憶','遺忘','想像','創意','靈感','智慧','知識','真理','哲學','邏輯','矛盾',
    '衝突','妥協','犧牲','奉獻','焦慮','憂鬱','孤獨','寂寞','思念','後悔','罪惡感','羞愧',
    '尷尬','委屈','憤怒','暴怒','狂喜','興奮','緊張','害怕','恐懼','驚訝','困惑','厭倦',
    '麻木','釋懷','滿足','感激','同情','憐憫','期待','失望','絕望','崩潰','時間','空間',
    '重力','慣性','摩擦力','浮力','磁力','電力','光速','黑洞','蟲洞','平行宇宙','多重宇宙','時間旅行',
    '量子糾纏','薛丁格的貓','大霹靂','進化','基因','細胞','病毒','免疫','新陳代謝','光合作用','食物鏈','生態系',
    '溫室效應','全球暖化','臭氧層','碳足跡','人工智慧','機器學習','大數據','雲端運算','區塊鏈','加密貨幣','元宇宙','虛擬實境',
    '擴增實境','物聯網','演算法','程式語言','資料庫','伺服器','防火牆','駭客','木馬病毒','數位足跡','社群媒體','網路成癮',
    '假新聞','同溫層','帶風向','鍵盤俠','網路霸凌','通貨膨脹','通貨緊縮','經濟衰退','泡沫經濟','供需法則','機會成本','邊際效益',
    '複利','股票','期貨','基金','債券','匯率','GDP','失業率','貧富差距','全球化','自由貿易','關稅壁壘',
    '壟斷','民主','專制','選舉','投票','民調','政黨','國會','憲法','法治','人權','言論自由',
    '新聞自由','三權分立','公民','難民','移民','外交','結盟','制裁','冷戰','畫蛇添足','守株待兔','亡羊補牢',
    '對牛彈琴','井底之蛙','杯弓蛇影','狐假虎威','望梅止渴','葉公好龍','自相矛盾','刻舟求劍','拔苗助長','濫竽充數','掩耳盜鈴','班門弄斧',
    '塞翁失馬','雪中送炭','火上加油','一箭雙鵰','半途而廢','破釜沉舟','臥薪嘗膽','完璧歸趙','負荊請罪','紙上談兵','四面楚歌','草木皆兵',
    '指鹿為馬','朝三暮四','雞犬不寧','狼狽為奸','鶴立雞群','魚目混珠','緣木求魚','隔靴搔癢','雪上加霜','錦上添花','畫龍點睛','社畜',
    '厭世','佛系','躺平','內捲','斜槓','過勞','爆肝','月光族','啃老族','月底吃土','報復性消費','報復性熬夜',
    '假日症候群','收假憂鬱','通勤地獄','加班文化','慣老闆','工具人','邊緣人','選擇困難','拖延症','完美主義','強迫症','密集恐懼',
    '幽閉恐懼','社交恐懼','冒牌者症候群','資訊焦慮','錯失恐懼','數位排毒','心流','同理心','換位思考','認知失調','確認偏誤','倖存者偏差',
    '蝴蝶效應','破窗效應','馬太效應','初戀','暗戀','失戀','曖昧','表白','告白','分手','復合','遠距離戀愛',
    '異地戀','結婚','離婚','外遇','劈腿','三角戀','一見鍾情','日久生情','七年之癢','老夫老妻','鄉愁','漂泊',
    '流浪','歸屬感','認同','傳承','文化衝擊','代溝','世代差異','中年危機','空巢期','退休','老化','死亡',
    '重生','涅槃','解脫','頓悟','修行','因果','骨牌效應','漣漪效應','雪球效應','連鎖反應','惡性循環','良性循環',
    '臨界點','引爆點','轉捩點','分水嶺','里程碑','雙面刃','灰色地帶','模糊地帶','潘朵拉的盒子','達摩克利斯之劍','阿基里斯腱','特洛伊木馬',
    '諾亞方舟','時來運轉','否極泰來','苦盡甘來','倒吃甘蔗','漸入佳境','每況愈下','江河日下','一落千丈','一蹶不振','東山再起','捲土重來',
    '浴火重生','鳳凰涅槃','起死回生','妙手回春','落井下石','趁火打劫','屋漏偏逢連夜雨','鏡花水月','海市蜃樓','空中樓閣','畫餅充飢','飲鴆止渴',
    '抱薪救火','推波助瀾','興風作浪','無中生有','無風起浪','空穴來風','捕風捉影','風聲鶴唳','疑神疑鬼','自欺欺人','百感交集','五味雜陳',
    '啼笑皆非','哭笑不得','進退兩難','左右為難','騎虎難下','進退維谷','內外交迫','腹背受敵','孤立無援','走投無路','山窮水盡','窮途末路',
    '油盡燈枯','心灰意冷','萬念俱灰','行屍走肉','生不如死','供過於求','求過於供','物以稀為貴','薄利多銷','殺雞取卵','竭澤而漁','寅吃卯糧',
    '入不敷出','寅支卯糧','開源節流','量入為出','精打細算','鋪張浪費','揮金如土','一擲千金','守財奴','鐵公雞','存在主義','虛無主義',
    '理想主義','現實主義','浪漫主義','個人主義','集體主義','機會主義','享樂主義','禁慾主義','唯物論','唯心論','宿命論','自由意志',
    '道德兩難','電車難題','囚徒困境','公地悲劇','看不見的手','詞窮','失眠','賴床','拖延','走神','放空','神遊',
    '恍神','健忘','選擇障礙','密恐','路痴','臉盲','怕生','認床','暈車','暈船','怯場','怕高',
    '斷捨離','極簡生活','慢活','樂活','小確幸','厭世代','草莓族','啃老','月光','卡奴','房奴','屋奴',
    '孩奴','血汗工廠','工時','過勞死','職業倦怠','退休金','黑天鵝','灰犀牛','長尾效應','二八法則','木桶理論','蝴蝶夢',
    '莊周夢蝶','黃粱一夢','南柯一夢','邯鄲學步','東施效顰','削足適履','守口如瓶','三緘其口','欲言又止','言外之意','弦外之音','話中有話',
    '一語雙關','似曾相識','似是而非','模稜兩可','含糊其辭','模糊焦點','避重就輕','顧左右而言他','答非所問','文不對題','牛頭不對馬嘴','雞同鴨講',
    '自言自語','喃喃自語','自圓其說','自打嘴巴','言行不一','表裡不一','情緒勒索','道德綁架','煤氣燈效應','受害者情結','玻璃心','巨嬰',
    '媽寶','公主病','王子病','控制狂','完美情人','靈魂伴侶','命中註定','緣分天註定','相見恨晚','相忘於江湖','漸行漸遠','形同陌路',
    '老死不相往來','熵增','蝴蝶振翅','平行時空','時間悖論','祖父悖論','雙縫實驗','觀察者效應','測不準原理','相對論','萬有引力','暗物質',
    '暗能量','反物質','宇宙膨脹','熱寂','永動機','自由落體','終端速度','共振','都卜勒效應','資訊爆炸','注意力經濟','演算法推薦',
    '同溫層效應','迴聲室效應','網軍','酸民','鄉民','婉君','帶節奏','引戰','炎上','翻車','塌房','退坑',
    '入坑','爆雷','劇透','棄追','單身',
  ],
};

// ---- 房間狀態 ----
const rooms = {}; // roomId -> room

function makeRoom(roomId) {
  return {
    id: roomId,
    players: {}, // socketId -> {id,name,score,connected}
    order: [],   // 畫家輪流順序 (socketId)
    customWords: [], // 自訂詞
    difficulty: '普通',
    state: 'lobby', // lobby | choosing | drawing | reveal
    drawerId: null,
    drawerIndex: -1,
    word: null,
    wordChoices: [],
    roundEndsAt: null,
    roundLength: 80, // 秒
    timer: null,
    guessedThisRound: {}, // socketId -> true
    hostId: null,
    roundNo: 0,
    maxRounds: 99,
    strokes: [], // 畫布歷史 (給中途加入的人)
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    state: room.state,
    drawerId: room.drawerId,
    difficulty: room.difficulty,
    roundEndsAt: room.roundEndsAt,
    roundNo: room.roundNo,
    hostId: room.hostId,
    customWordsCount: room.customWords.length,
    players: room.order
      .map((id) => room.players[id])
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected,
        isDrawer: p.id === room.drawerId, guessed: !!room.guessedThisRound[p.id] })),
  };
}

function broadcast(room) {
  io.to(room.id).emit('room', publicRoom(room));
}

function wordPool(room) {
  const base = DEFAULT_WORDS[room.difficulty] || [];
  return [...base, ...room.customWords];
}

function pickWords(room, n = 4) {
  const pool = [...wordPool(room)];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function maskedWord(word) {
  // 給猜題者看的提示: 顯示字數
  if (!word) return '';
  return word.replace(/\S/g, '＿').split('').join(' ');
}

function clearRoundTimer(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
}

function nextDrawer(room) {
  const connectedIds = room.order.filter((id) => room.players[id] && room.players[id].connected);
  if (connectedIds.length < 2) {
    room.state = 'lobby';
    room.drawerId = null;
    room.word = null;
    broadcast(room);
    io.to(room.id).emit('system', { msg: '至少要 2 個人才能開始,先揪人吧。' });
    return;
  }
  room.drawerIndex = (room.drawerIndex + 1) % room.order.length;
  // 找到下一個還在線的人
  let guard = 0;
  while ((!room.players[room.order[room.drawerIndex]] ||
          !room.players[room.order[room.drawerIndex]].connected) && guard < room.order.length) {
    room.drawerIndex = (room.drawerIndex + 1) % room.order.length;
    guard++;
  }
  room.drawerId = room.order[room.drawerIndex];
  room.roundNo += 1;
  room.state = 'choosing';
  room.word = null;
  room.wordChoices = pickWords(room, 4);
  room.guessedThisRound = {};
  room.strokes = [];
  io.to(room.id).emit('clearCanvas');
  broadcast(room);

  // 只給畫家選詞選項
  io.to(room.drawerId).emit('chooseWord', { choices: room.wordChoices });
  io.to(room.id).emit('system', {
    msg: `輪到 ${room.players[room.drawerId].name} 出題畫圖!`,
  });

  // 畫家 15 秒沒選就自動選第一個
  clearRoundTimer(room);
  let countdown = 15;
  room.timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearRoundTimer(room);
      if (room.state === 'choosing') startDrawing(room, room.wordChoices[0]);
    }
  }, 1000);
}

function startDrawing(room, word) {
  clearRoundTimer(room);
  room.word = word;
  room.state = 'drawing';
  room.roundEndsAt = Date.now() + room.roundLength * 1000;
  broadcast(room);

  io.to(room.drawerId).emit('yourWord', { word });
  io.to(room.id).emit('roundStart', {
    masked: maskedWord(word),
    length: word.length,
    endsAt: room.roundEndsAt,
  });

  clearRoundTimer(room);
  room.timer = setInterval(() => {
    const left = Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
    io.to(room.id).emit('tick', { left });
    if (left <= 0) endRound(room, 'timeup');
  }, 1000);
}

function everyoneGuessed(room) {
  const guessers = room.order.filter(
    (id) => room.players[id] && room.players[id].connected && id !== room.drawerId
  );
  return guessers.length > 0 && guessers.every((id) => room.guessedThisRound[id]);
}

function endRound(room, reason) {
  clearRoundTimer(room);
  room.state = 'reveal';
  room.advancing = false; // 是否已開始換下一局(防重複)
  const revealedWord = room.word;
  broadcast(room);
  io.to(room.id).emit('roundEnd', {
    word: revealedWord,
    reason,
    scores: room.order.map((id) => room.players[id]).filter(Boolean)
      .map((p) => ({ name: p.name, score: p.score })),
  });
  // 最多等 6 秒自動換,期間任何人可按「下一局」提前換
  room.revealTimer = setTimeout(() => advanceRound(room), 6000);
}

// 換到下一局(手動或自動都走這裡,確保只換一次)
function advanceRound(room) {
  if (!rooms[room.id] || room.state !== 'reveal' || room.advancing) return;
  room.advancing = true;
  if (room.revealTimer) { clearTimeout(room.revealTimer); room.revealTimer = null; }
  nextDrawer(room);
}

io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('join', ({ roomId, name }) => {
    roomId = (roomId || 'lobby').trim().toLowerCase();
    name = (name || '無名氏').trim().slice(0, 16) || '無名氏';
    if (!rooms[roomId]) rooms[roomId] = makeRoom(roomId);
    const room = rooms[roomId];
    joinedRoom = room;
    socket.join(roomId);

    room.players[socket.id] = { id: socket.id, name, score: 0, connected: true };
    if (!room.order.includes(socket.id)) room.order.push(socket.id);
    if (!room.hostId) room.hostId = socket.id;

    socket.emit('joined', { roomId, youId: socket.id, hostId: room.hostId });
    // 補送目前畫布給中途加入者
    if (room.strokes.length) socket.emit('canvasHistory', room.strokes);
    if (room.state === 'drawing') {
      socket.emit('roundStart', {
        masked: maskedWord(room.word),
        length: room.word.length,
        endsAt: room.roundEndsAt,
      });
    }
    broadcast(room);
    io.to(room.id).emit('system', { msg: `${name} 加入了房間 👋` });
  });

  socket.on('start', () => {
    const room = joinedRoom;
    if (!room || room.hostId !== socket.id) return;
    if (room.state !== 'lobby' && room.state !== 'reveal') return;
    room.roundNo = 0;
    room.drawerIndex = -1;
    Object.values(room.players).forEach((p) => (p.score = 0));
    nextDrawer(room);
  });

  socket.on('chooseWord', ({ word }) => {
    const room = joinedRoom;
    if (!room || room.state !== 'choosing' || socket.id !== room.drawerId) return;
    if (!room.wordChoices.includes(word)) return;
    startDrawing(room, word);
  });

  // 任何人在結算畫面按「下一局」可提前換局
  socket.on('nextRound', () => {
    const room = joinedRoom;
    if (!room || room.state !== 'reveal') return;
    advanceRound(room);
  });

  // 畫家不喜歡這批詞,重抽一次
  socket.on('rerollWords', () => {
    const room = joinedRoom;
    if (!room || room.state !== 'choosing' || socket.id !== room.drawerId) return;
    room.wordChoices = pickWords(room, 4);
    io.to(room.drawerId).emit('chooseWord', { choices: room.wordChoices });
  });

  socket.on('setDifficulty', ({ difficulty }) => {
    const room = joinedRoom;
    if (!room || room.hostId !== socket.id) return;
    if (DEFAULT_WORDS[difficulty]) { room.difficulty = difficulty; broadcast(room); }
  });

  socket.on('addWords', ({ words }) => {
    const room = joinedRoom;
    if (!room) return;
    const list = String(words || '')
      .split(/[\n,，、]/).map((w) => w.trim()).filter(Boolean).slice(0, 200);
    let added = 0;
    list.forEach((w) => {
      if (!room.customWords.includes(w)) { room.customWords.push(w); added++; }
    });
    broadcast(room);
    socket.emit('system', { msg: `加了 ${added} 個自訂詞,現在共 ${room.customWords.length} 個。` });
  });

  // ---- 畫圖事件 ----
  // 單筆(目前只用於填色指令)
  socket.on('draw', (data) => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId || room.state !== 'drawing') return;
    room.strokes.push(data);
    socket.to(room.id).emit('draw', data);
  });
  // 批次線條:一次收一串,存進歷史並原封廣播
  socket.on('drawBatch', (arr) => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId || room.state !== 'drawing') return;
    if (!Array.isArray(arr) || !arr.length) return;
    if (arr.length > 500) arr = arr.slice(0, 500); // 防爆量
    for (const d of arr) room.strokes.push(d);
    socket.to(room.id).emit('drawBatch', arr);
  });
  socket.on('clearCanvas', () => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId) return;
    room.strokes = [];
    io.to(room.id).emit('clearCanvas');
  });
  socket.on('undo', () => {
    const room = joinedRoom;
    if (!room || socket.id !== room.drawerId) return;
    // 移除最後一筆 (到上一個 strokeStart)
    let i = room.strokes.length - 1;
    while (i >= 0 && !room.strokes[i].start) i--;
    if (i >= 0) room.strokes = room.strokes.slice(0, i);
    io.to(room.id).emit('canvasHistory', room.strokes);
  });

  // ---- 猜題 / 聊天 ----
  socket.on('guess', ({ text }) => {
    const room = joinedRoom;
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    text = String(text || '').slice(0, 60);
    if (!text.trim()) return;

    const isDrawer = socket.id === room.drawerId;
    const canGuess = room.state === 'drawing' && !isDrawer && !room.guessedThisRound[socket.id];

    if (canGuess && room.word && normalize(text) === normalize(room.word)) {
      // 答對!
      room.guessedThisRound[socket.id] = true;
      const left = Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
      const gain = Math.max(10, Math.round(left / room.roundLength * 100) + 20);
      player.score += gain;
      // 畫家也得分 (每有人猜中 +15)
      if (room.players[room.drawerId]) room.players[room.drawerId].score += 15;

      io.to(room.id).emit('correct', { name: player.name, gain });
      broadcast(room);
      if (everyoneGuessed(room)) endRound(room, 'allguessed');
      return;
    }

    // 一般聊天 / 猜錯 (畫圖中且接近正確答案的字不直接顯示,避免暴雷就照常顯示)
    io.to(room.id).emit('chat', {
      name: player.name, text, isDrawer,
      guessed: !!room.guessedThisRound[socket.id],
    });
  });

  socket.on('disconnect', () => {
    const room = joinedRoom;
    if (!room || !room.players[socket.id]) return;
    const name = room.players[socket.id].name;
    room.players[socket.id].connected = false;
    io.to(room.id).emit('system', { msg: `${name} 離開了 👋` });

    // 換房主
    if (room.hostId === socket.id) {
      const next = room.order.find((id) => room.players[id] && room.players[id].connected);
      room.hostId = next || null;
    }
    // 如果是正在畫的人跑了,直接結束這回合
    if (room.drawerId === socket.id && (room.state === 'drawing' || room.state === 'choosing')) {
      io.to(room.id).emit('system', { msg: '畫家落跑了,跳下一題!' });
      endRound(room, 'drawer_left');
    } else {
      broadcast(room);
    }

    // 房間沒人就清掉
    const anyone = room.order.some((id) => room.players[id] && room.players[id].connected);
    if (!anyone) { clearRoundTimer(room); delete rooms[room.id]; }
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 詞庫匯出:/words/房號  -> 下載該房目前完整詞庫(內建+自訂)
app.get('/words/:room', (req, res) => {
  const id = String(req.params.room || '').trim().toLowerCase();
  const room = rooms[id];
  const data = {
    room: id,
    difficulty: room ? room.difficulty : null,
    builtin: DEFAULT_WORDS,
    custom: room ? room.customWords : [],
    exportedAt: new Date().toISOString(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="words-${id || 'default'}.json"`);
  res.json(data);
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`\n🎨 你畫我猜跑起來了 -> http://localhost:${PORT}\n`);
});
