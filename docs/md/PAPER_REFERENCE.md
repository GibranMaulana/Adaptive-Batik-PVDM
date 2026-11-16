Available online at www.sciencedirect.com
TheJournalofSystemsandSoftware81(2008)150–158
www.elsevier.com/locate/jss
A high quality steganographic method with pixel-value differencing
|            |     |      |       | and modulus     | function |                 |     |       |     |
| ---------- | --- | ---- | ----- | --------------- | -------- | --------------- | --- | ----- | --- |
|            |     |      | a,    | a,              |          | b,              |     |       | b,* |
| Chung-Ming |     | Wang | Nan-I | Wu Chwei-Shyong |          | Tsai Min-Shiang |     | Hwang |     |
aInstituteofComputerScience,NationalChungHsingUniversity,250KuoKuangRoad,Taichung402,Taiwan,ROC
bDepartmentofManagementInformationSystems,NationalChungHsingUniversity,250KuoKuangRoad,Taichung402,Taiwan,ROC
Received18February2006;receivedinrevisedform24January2007;accepted24January2007
Availableonline20February2007
Abstract
Inthispaper,weshallproposeanewimagesteganographictechniquecapableofproducingasecret-embeddedimagethatistotally
indistinguishable from the original image bythehuman eye. Inaddition, ournew methodavoidsthe falling-off-boundary problem by
usingpixel-valuedifferencingandthemodulusfunction.First,wederiveadifferencevaluefromtwoconsecutivepixelsbyutilizingthe
pixel-value differencing technique (PVD). The hiding capacity of the two consecutive pixels depends on the difference value. In other
words, the smoother area is, the less secret data can be hidden; on the contrary, the more edges an area has, the more secret data
can be embedded. This way, the stego-image quality degradation is more imperceptible to the human eye. Second, the remainder of
thetwoconsecutivepixelscanbecomputedbyusingthemodulusoperation,andthensecretdatacanbeembeddedintothetwopixels
bymodifyingtheirremainder.Inourscheme,thereisanoptimalapproachtoaltertheremaindersoastogreatlyreducetheimagedis-
tortioncausedbythehidingofthesecretdata.Thevaluesofthetwoconsecutivepixelsarescarcelychangedaftertheembeddingofthe
secretmessagebytheproposedoptimalalterationalgorithm.Experimentalresultshavealsodemonstratedthattheproposedschemeis
| secureagainst       | the RS detectionattack. |           |     |     |     |     |     |     |     |
| ------------------- | ----------------------- | --------- | --- | --- | --- | --- | --- | --- | --- |
| (cid:2)2007Elsevier | Inc. Allrights          | reserved. |     |     |     |     |     |     |     |
Keywords: Datahiding;Steganography;Coverimage;Stego-image;Imperceptible;Modulusoperation
1. Introduction received. The opponent may randomly attack the stego-
|     |     |     |     |     | image if | he/she doubts | the stego-image | carries | any secret |
| --- | --- | --- | --- | --- | -------- | ------------- | --------------- | ------- | ---------- |
In recent years, enormous research efforts have been message because the appearance of the stego-image shows
invested in the development of digital image stegano- obvious artifacts of hiding effect (Liao et al., 2007;
graphic techniques. The major goal of steganography is Simmons, 1984). For this reason, an ideal steganography
toenhancecommunicationsecuritybyinsertingsecretmes- scheme, to keep the stego-image from drawing attention
sage into the digital image, modifying the nonessential from the opponent, should maintain an imperceptible
pixels of the image (Feng et al., 2006; Petitcolas et al., stego-image quality. That is to say, if there are more simi-
1999). The image after the embedding of the secret mes- laritiesbetweenthecoverimageandthestego-image,itwill
sage, so-called stego-image, is then sent to the receiver be harder for an attacker to find out that the stego-image
through a public channel. hasimportantsecretdatahiddeninsideit(WuandHwang,
In the transmission process, the public channel may be 2007). This way, the secret data is more likely to travel
intentionally monitored by some opponent who tries to from the sender to the receiver safe and sound.
prevent the message from being successfully sent and For the past decade, many steganographic techniques
|     |     |     |     |     | for still | images have been     | presented. | A simple | and well-     |
| --- | --- | --- | --- | --- | --------- | -------------------- | ---------- | -------- | ------------- |
| *   |     |     |     |     | known     | approach is directly | hiding     | secret   | data into the |
Correspondingauthor.Tel.:+886422855401;fax:+886422857173.
|     |     |     |     |     | least-significant | bit (LSB) | of each | pixel in an | image. Then, |
| --- | --- | --- | --- | --- | ----------------- | --------- | ------- | ----------- | ------------ |
E-mailaddress:mshwang@nchu.edu.tw(M.-S.Hwang).
| 0164-1212/$-seefrontmatter |     | (cid:2)2007ElsevierInc.Allrightsreserved. |     |     |     |     |     |     |     |
| -------------------------- | --- | ----------------------------------------- | --- | --- | --- | --- | --- | --- | --- |
doi:10.1016/j.jss.2007.01.049

C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158 151
basedontheLSBtechnique,ageneticalgorithmofoptimal cally, the algorithm can detect the existence of the LSB
LSB substitution is now also available to improve the scheme with high precision when the hidden capacity is
stego-image quality of the simple LSB method (Wang more than 0.005bits per pixel. However, when the hidden
etal.,2001).Inaddition,Changetal.(2003)havealsopre- capacityislessthan0.005bitsperpixel,theRSsteganalytic
sented a fast and efficient optimal LSB method based on algorithm is completely ineffective (Fridrich et al., 2001;
thedynamicprogrammingstrategythatimprovesthecom- Ker, 2004).
putation time of Wang et al.’s scheme (Wang et al., 2001). The LSB-based methods mentioned above, directly
A novel simple LSB technique based on optimal pixel embed the secret data into the spatial domain in an
adjustmentwaspresentedtoachievethegoalofimproving unreasonable way without taking into consideration the
the stego-image quality (Chan and Cheng, 2004). Besides, difference in hiding capacity between edge and smooth
Thien and Lin also presented a simple LSB scheme based areas. In general, the alteration tolerance of an edge area
on the modulus function to improve the stego-image qual- ishigherthanthatofasmootharea.Thatistosay,anedge
ity(ThienandLin,2003).Inordertogainahigherpayload areacanconcealmoresecretdatathanasmootharea.With
thanwhenthe4-LSBsmethodisused,Wanghasproposed thisconceptinmind,WuandTsaipresentedsteganographic
two new schemes based on the modulo operator (Wang, scheme that offers high imperceptibility to the stego-image
2005).Wuetal.havealsopresentedacombinationscheme by selecting two consecutive pixels as the object of embed-
on the basis of pixel-value differencing and LSB replace- ding. The payload of Wu and Tsai’s scheme is determined
ment with a view to improving the hiding capacity while by the difference value between the pixels (Wu and Tsai,
maintaining acceptable stego-image quality (Wu et al., 2003). In Wu and Tsai’s method, they determine whether
2005).Inordertoenhancethesecurity,ontheotherhand, thetwoconsecutivepixelsbelongtoanedgeorsmootharea
LinandTsaihaveproposedanewapproachthatintegrates bycheckingoutthedifferencevaluebetweenthetwoconsec-
the concept of secret image sharing and steganographic utive pixels. If the difference value is large, that means the
techniques with the additional capability of image authen- twopixelsarelocatedinanedgeareas,andmoresecretdata
tication(LinandTsai,2004).LouandLiu(2002)proposed canbehiddenhere.Onthecontrary,ifthedifferencevalueis
a LSB-based steganographic method that can resist the small, that means the two pixels are located in a smooth
common-cover-carrier attack by embedding variable-size area,andlesssecretdatacanbeembedded.Therefore,their
secret data and redundant Gaussion noise. scheme producesstego-images that are more similar to the
There are many steganographic schemes have also been original images than those produced by LSB substitution
proposed for binary images. For example, Tseng et al. schemes, which directly embed secret data into the cover
(2002) designed a binary matrix and an integer weight imagewithoutconsideringthedifferencesbetweenadjacent
matrix so as to increase the payload of each sub-image. pixels.Furthermore,ChangandTsenghaveproposedanew
It can hide blog (m·n+1)c into a sub-image with m·n method based on side match where the users can consult
2
pixelsbymanipulatingatmosttwobitsoftheoriginalcon- morethantwoneighboringpixelstodeterminethepayload
tent.Inaddition,TsengandPan(2002)furtherproposeda ofeachpixel(ChangandTseng,2004).
high quality data hiding scheme based on (Tseng et al., In this paper, in order to provide a better stego-image
2002) that searches for the more undetectable pixels of quality than Wu and Tsai’s scheme (Wu and Tsai, 2003),
the cover image as targets of modification. Wu and Liu weshallproposeanoveltechniquebasedonpixel-valuedif-
(2004) used the shuffling method to equalize the uneven ference and modulus function. In Wu and Tsai’s scheme,
embedding capacity of each image block for the purpose which is also known as the PVD method, the difference
of providing a greater hiding capacity and higher security. value between two consecutive pixels is regarded as a
The hidden message of their scheme can be used to serve featureforrecordingthesecretmessage.Whentheoriginal
various purposes such as authentication, annotation, and difference value is unequal to the secret message, the two
verification. In addition, aside from regular digital images, consecutive pixels will be directly adjusted so that their
someothermultimediaformssuchas3DmodelsandPDF differencevaluecanstandforthesecretdata.However,con-
texts can also serve as the cover media. The first stegano- siderablestego-imagedistortioncanhappenwhenthePVD
graphic method built on point-sampled geometry has been methodadjuststhetwoconsecutivepixelstohidethesecret
presentedbyWangandWang(2006),andthefirststegano- datainthedifferencevalue.Tomakeadifference,withour
graphic system that works on PDF English texts has been new method, we shall improve the stego-image quality by
created by Zhong et al. (2007). Recently, various kinds of adjusting the remainder of the two consecutive pixels
steganalysisdetectorshavebeenundersteadydevelopment, instead of the difference value. Besides that, the falling-off-
andsomehavebeenpresentedinanattempttohelpdetect boundary problem may probably worsen the situation
the existence of messages hidden in images in place of whenthePVDmethodaloneisused,especiallyeitherwhen
visualinspection.Forexample,thewell-knownRSstegan- thetwoconsecutivepixelsarelocatedinanextremeedgeor
alytic algorithm by Fridrich et al. (2001) is able to detect smootharea,orwhenthevaluesofthetwoconsecutivepix-
the existence of LSB steganography. Basically, the els form a contrast. To overcome the falling-off-boundary
detection capability of the RS steganalytic algorithm problem, our new method re-revises the remainder of the
depends on the capacity of the hidden message. Specifi- two consecutive pixels.

152 C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158
The rest of this paper is organized as follows. We will Table1
briefly review Wu and Tsai’s scheme in Section 2. In Sec- AnillustrationofWuandTsai’sembeddingprocess
tion3,theembeddingandextractingalgorithmsofthepro- Secretdata P =32 P =32 Newdifferencevalue
(i,x) (i,y)
posed method based on the modulus operation will be (decimalvalue) ofP (i,x) andP (i,y)
presented respectively. The experimental results and ana- 0 Nomodify Nomodify 0
lyzes will be in Section 4, followed by some concluding 1 +1 Nomodify 1
2 +1 (cid:3)1 2
remarks in Section 5.
3 +2 (cid:3)1 3
4 +2 (cid:3)2 4
2. Review of Wu and Tsai’s scheme 5 +3 (cid:3)2 5
6 +3 (cid:3)3 6
7 +4 (cid:3)3 7
Let us begin with the background on which the embed-
dingalgorithmofmethod(WuandTsai,2003)isbuildup.
Given a cover image F sized M·N. F is a sub-block of F
i
that has two consecutive pixels broken down by partition- embedding process is accomplished. An illustration of
ing F in raster scan order such that F ¼fF i ji¼ how P (i,x) and P (i,y) can be adjusted by Wu and Tsai’s
1;2;...;M(cid:2)Ng. By definition each F has two elements scheme for the purpose of hiding secret data is shown in
2 i
P and P . The pixel values of P and P are Table 1. In Table 1, assume the pixel values of sub-block
(i,L) (i,R) (i,L) (i,R)
P (i,x) and P (i,y) , respectively. The difference value d i of F i are P (i,x) =32, P (i,y) =32, and the width w j of their
P (i,x) and P (i,y) can be derived by Eq. (1). sub-rangeis8withl j =0andu j =7.Then,3bitsofthese-
cretdataistakenoutandputintoF.Allthepossibleways
d ¼jP (cid:3)P j: ð1Þ i
i ði;xÞ ði;yÞ of adjusting P and P are shown in Table 1. Obvi-
(i,x) (i,y)
On the other hand, they design a range table R which ously, the falling-off-boundary problem will occur and
consists of n contiguous sub-ranges R j ; in other words, would not conform Eq. (3) if 06P (i,x) 63 and 06
R={R j jj=1,2,...,n}. The major job of the range table P (i,y) 63.
istoprovideinformationaboutthehidingcapacityofeach The recovery process of Wu and Tsai’s method is quite
F. Each sub-range R has its lower and upper bound val- simple and easy. Given two consecutive pixels P0 and
i j ði;xÞ
ues, say l and u, so that we have R 2[l,u]. The width P0 of the stego-image, compute their difference value d0
j j j j j ði;yÞ i
w of each R is selected to be a power of 2, and can be and obtain d0 ¼jP0 (cid:3)P0 j. Use the original range table
j j i ði;xÞ ði;yÞ
computed by w j =u j (cid:3)l j +1. Each sub-block F i relates to R in the embedding phase to obtain the same R j and w j .
its sub-range R j from the range table R such that R j = The length t i of the hiding capacity also can be gained by
min(d,w) and d 2[l,u]. This way, hiding capacity of using Eq. (2). Calculate the real difference value
i j i j j
two consecutive pixels can be obtained by d0 i 0 ¼d0 i (cid:3)l j andconvertthedecimalvalued0 i 0 intoabinary
string whose length is t bits. For example, assume
t ¼blgðwÞc: ð2Þ i
i j d00 ¼7 and t =3, and then secret data 111 is
i ð10Þ i (2)
Here,t isthenumberofbitsthatcanbehiddeninF.Read extracted.
i i
t bits from the binary secret data stream and transform t
i i
into its decimal value t0. A new difference value d0 can be
i i
generated by putting l and t0 together: 3. The proposed method
j i
d0 ¼t0þl:
i i j Instead of the difference value, the proposed scheme
NowthesecretdatacanbeembeddedintoF i bymodifying modifies the remainder of two consecutive pixels P (i,x)
its P (i,x) and P (i,y) such that d i ¼d0 i . The details of the and P (i,y) for better stego-image quality. The proposed
embedding criteria are as follows: embedding and extracting algorithms are presented in the
subsections below.
8ðP þdm=2e;P (cid:3)bm=2cÞ;
ði;xÞ ði;yÞ
>>>>>>>>>>>>><
ðP
i
i
ði
f
f
;xÞ
P
P
(cid:3)
ði;x
b
Þ
m
P
<
=2
P
P
c;
ði
P
;yÞ
ði
a
;
a
y
n
Þ
n
d
þ
d
d
d
d
0
m
0
i
>
>
=2
d
d
eÞ
i
;
;
;
3
S
.
t
1
e
.
p
T
1
h
:
e
G
em
iv
b
e
e
n
d
a
di
s
n
u
g
b
a
-b
lg
lo
or
c
i
k
th
F
m
i
composedoftwocontinuous
ðP0 ;P0 Þ¼ ði;xÞ ði;yÞ i i ð3Þ pixels P and P from the cover image, obtain
ði;xÞ ði;yÞ >>>>>>>>>>>>>: ð
ð
P
P
i
i
ð
ð
i
i
f
f
;
;
x
x
Þ
Þ
P
P
(cid:3)
þ
ði;x
d
d
Þ
m
m
P
<
=
=
2
2
P
P
e
e
;
;
ði
P
P
;yÞ
ð
ð
i
i
a
;
;
a
y
y
n
Þ
Þ
n
d
þ
(cid:3)
d
d
b
b
d
0
m
m
0 i
6
6
=
=
2
2
d
c
c
d
Þ
Þ
i
;
;
;
;
t
c
e
R
h
a
a
j
e
p
c
2
h
a
d
c
[
i
F
l
i
ff
j
t
,
i
y
e
u
(
b
r i
j
, e
]
t
y
x
,
i
n )
u
c
b
t
e
h
s
it
i
e
n
s
v
,
g
a
w
a
lu
W
(
n
i
i
d
e ,
d
y
u
t
) d
h
t
i
a
h
,
n
w
e
t
d
h
j
d
e
=
T
e
s
c
s
u
u
i
a
m
j
b
i
(cid:3)
’
-
s
a
r
l
a
l
s
j
c
n
v
+
h
a
g
e
l
e
1
u
m
,
R
e
e
t
j
t
h
a
0 i
s
e
c
u
o
c
c
f
o
h
h
r
t
i
i
d
d
th
i
i
f
n
n
o
a
g
g
r
t
ði;xÞ ði;yÞ i i to Section 2.
wherem¼jd0(cid:3)d j.WecangainnewpixelvaluesP0 and Step 2: Compute the remainder values P , P
i i ði;xÞ rem(i,x) rem(i,y)
P0 after the calculation in Eq. (3) and replace P and and F of P , P and sub-block F respec-
ði;yÞ (i,x) rem(i) (i,x) (i,y) i
P in the cover image with the new values so that the tively by using the following equations:
(i,y)

C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158 153
P ¼P modt0; Table2
remði;xÞ ði;xÞ i
Anillustrationoftheproposedalgorithmmodifyingtheremainderoftwo
P ¼P modt0;
remði;yÞ ði;yÞ i consecutivepixels
F ¼ðP þP Þmodt0: ð4Þ
remðiÞ ði;xÞ ði;yÞ i Secretdata P (i,x) =32 P (i,y) =32, Thetotal
(decimalvalue) P =0 P =0 remainderF
Step 3: Embedt bitsofsecretdataintoF byalteringP rem(i,x) rem(i,y) rem(i)
i i (i,x)
and P such that F ¼t0. The optimal 0 Nomodify Nomodify 0
(i,y) remðiÞ i 1 +1 Nomodify 1
approach to altering the P and P to achieve
(i,x) (i,y) 2 +1 +1 2
the minimum distortion is as follows:
3 +2 +1 3
Case 1: F remðiÞ >t0 i and m6ð2tiÞ=2 and P (i,x) PP (i,y) 4 +2 +2 4
ðP0 ;P0 Þ¼ðP (cid:3)dm=2e;P (cid:3)bm=2cÞ; 5 (cid:3)2 (cid:3)1 5
ði;xÞ ði;yÞ ði;xÞ ði;yÞ
Case 2: F >t0 and m6ð2tiÞ=2 and P <P 6 (cid:3)1 (cid:3)1 6
remðiÞ i (i,x) (i,y) 7 (cid:3)1 Nomodify 7
ðP0 ;P0 Þ¼ðP (cid:3)bm=2c;P (cid:3)dm=2eÞ;
ði;xÞ ði;yÞ ði;xÞ ði;yÞ
Case 3: F >t0 and m>ð2tiÞ=2 and P PP
remðiÞ i (i,x) (i,y)
C C a a s s e e 4 5 : : ð ð F F P P 0 ð 0 ð r r i i e e ; ; m m x x Þ Þ ð ð ; ; i i Þ Þ P P > 6 0 ð 0 ð i i ; ; y y t t Þ Þ 0 i 0 i Þ Þ a a ¼ ¼ n n d d ð ð P P m m ð ð i i ; ; x x > 6 Þ Þ þ þ ð ð 2 2 b d t t i m m i Þ Þ = = 1 1 = = 2 2 2 2 a a c e n n ; ; P P d d ð ð i i P P ; ; y y Þ Þ ( ( i i , , þ þ x x ) ) d b < P m m P 1 1 P = = (i ( 2 2 , i y , e c y ) Þ Þ ) ; ; A t ( 2 P h 5 f e 5 ( t i e , . r x r a ) F , n S P i g t n ( e e i a , p y l o ) l ) y f 4 , , i ð n P ð w P 0 ð t 0 i e h ; 0 ð x i Þ e ; ; x p Þ P c ; u o P 0 ð t 0 i; v 0 ð y i Þ e u ;y Þ r Þ s Þ c e i a m c n ð a a P n n g 0 ð o 0 i e ; b t xÞ a e ; g n P o c d 0 ð o 0 i b ;y r t e Þ r h Þ l e o e c i w t n e e m d 0 p b o l s e a o r d c d o e th i v n o a e g r t f
ðP0 ði;xÞ ;P0 ði;yÞ Þ¼ðP ði;xÞ þbm=2c;P ði;yÞ þdm=2eÞ; algorithm is accomplished.
Case 6: F 6t0 and m6ð2tiÞ=2 and P <P
remðiÞ i (i,x) (i,y)
ðP0 ði;xÞ ;P0 ði;yÞ Þ¼ðP ði;xÞ þdm=2e;P ði;yÞ þbm=2cÞ; A simple example of regulating the remainder value for
Case 7: F remðiÞ 6t0 i and m>ð2tiÞ=2 and P (i,x) PP (i,y) hiding secret data is shown in Table 2. Suppose we have a
Case 8: ð F P0 ð r i e ; m xÞ ð ; iÞ P 6 0 ði;y t Þ 0 i Þ a ¼ nd ðP m ði;x > Þ (cid:3) ð2 d ti m Þ= 1 = 2 2 a e n ;P d ði P ;yÞ (i, (cid:3) x) b < m P 1 = (i 2 ,y c ) Þ; s P u (i b ,y - ) b = oc 3 k 2 F .T i w he it n h , t t w he o r s e u m c a ce in ss d i e v r e v p a i l x u e e l F va re l m u ( e i) s o P f ( F i,x i ) is = 0 3 . 2 If a t n h d e
ðP0 ði;xÞ ;P0 ði;yÞ Þ¼ðP ði;xÞ (cid:3)bm 1 =2c;P ði;yÞ (cid:3)dm 1 =2eÞ. 3bits (i.e. t i =3, and t0 i ¼23 ¼8) of the secret data are
In the above approach, m¼jF remðiÞ (cid:3)t0 i j, m 1 ¼ selected to be embedded into F i , P (i,x) and P (i,y) will be
2ti (cid:3)jF remðiÞ (cid:3)t0 i jandP0 ði;xÞ ;P0 ði;yÞ arenewpixel values modifiedtoholdthe3-bitsecretdata.Table2demonstrates
aftertheembeddingoft i bitsofthesecretdatainto thatourschemehasbetterperformanceinreducingthedif-
sub-blockF i .AfterStep3,ifP0 ði;xÞ orP0 ði;yÞ overflows ference between (P (i,x) ,P (i,y) ) and ðP0 ði;xÞ ;P0 ði;yÞ Þ.
theboundaryvalue0or255,thenexecuteStep4for Next, we offer an example to show how our mechanism
revising P0 ði;xÞ and P0 ði;yÞ . If not, the purpose of con- ofkeepingthepixelvaluesfromexceedingtherange[0,255]
cealing secret data will be completed after the after secret data embedding. As shown in Table 3, we re-
replacement of (P (i,x) ,P (i,y) ) by ðP0 ði;xÞ ;P0 ði;yÞ Þ in the assume P (i,x) =0 and P (i,y) =0 in the previous example,
cover image. and then the falling-off-boundary problem happens such
Step 4: Consider thethree situations below where the fall- that P0 <0 or P0 <0 when the decimal value of the
a in n g d -o P ff 0 ð - i; b yÞ o a u s nd fo a l r l y ow p s r : oblemhappensandreviseP0 ði;xÞ r s e e - c a re d t ju ð d i s ;x a t Þ e t d a i b s y 5 a , d 6 d , ð i i n o ;y g Þ r u 7. p H to ow 4 e s v y e n r, ch P r 0 ð o i;x n Þ o a u n s d ly. P A 0 ði;y f Þ te c r a t n ha b t e ,
Case 1: If P (i,x) (cid:4)0, P (i,y) (cid:4)0 and P0 ði;xÞ <0 or P0 ði;yÞ <0, the values of P0 ð 0 i;xÞ and P0 ð 0 i;yÞ will fall within the range of
thenre-adjustP0 andP0 tobeP00 andP0 by 0–255.
ði;xÞ ði;yÞ ði;xÞ ði;yÞ
ðP00 ;P00 Þ¼ðP0 þð2tiÞ=2;P0 þð2tiÞ=2Þ:
ði;xÞ ði;yÞ ði;xÞ ði;yÞ
3.2. The extracting algorithm
Case 2: If P (cid:4)255, P (cid:4)255 and P0 >255 or
(i,x) (i,y) ði;xÞ
P0 >255, then re-adjust P0 and P0 to be
ði;yÞ ði;xÞ ði;yÞ Intherecoveryprocess,wecanquicklyextractthesecret
P00 and P00 by
ði;xÞ ði;yÞ data without using the original image. Nevertheless, it is
ðP00 ;P00 Þ¼ðP0 (cid:3)ð2tiÞ=2;P0 (cid:3)ð2tiÞ=2Þ:
ði;xÞ ði;yÞ ði;xÞ ði;yÞ
Case 3: If P and P form a great contrast (i.e. Table3
(i,x) (i,y)
An illustration of solving the falling-off-boundary problem by re-modi-
d >128), then re-adjusted P0 and P0 by
i ði;xÞ ði;yÞ fyingthe(P0 ;P0 )
ði;xÞ ði;yÞ
8 ð0;P0 þP0 Þ; Secretdata P (i,x) =0, P (i,y) =0, Thetotal
>>>>>>>>>>><
ðP
i
i
0
ði
f
f
;xÞ
ð P
P
i;
þ
y 0
ð
0
Þ
i;x
P
Þ
0
ð
<
P
i;yÞ
ð 0 i
;
0
;x
0
Þ a
Þ
a
n
;
n
d
d
P
P
0
ð
0
i;yÞ
P
<
0
0
;
;
(
0
1
decimalvalue) P
N
+
r
1
o
em
m
(i,x
o
)
d
=
ify
0
N
N
P r
o
o
em
m
m
(i,y
o
o
)
d
d
=
i
i
f
f
y
y
0
0
1
remainderF rem(i)
ðP00 ;P00 Þ¼ ði;xÞ ði;yÞ 2 +1 +1 2
ði;xÞ ði;yÞ ð255;P0 þðP0 (cid:3)255ÞÞ; 3 +2 +1 3
>>>>>>>>>>>:
ðP
i
i
0
ði
f
f
;xÞ
P
P
þ
0
ð
0
i
ð
;
i
x
;
ð
Þ
y
P
Þ
>
P
0
ði;y
2
Þ
0
5
(cid:3)
5
a
ði
n
;
2
x
a
Þ
d
5
n
5
d
P
Þ;
0
P
2
0
ð
5
i;
5
y
>
Þ
Þ;
P
255
0
:
;
6
4
5
(
+
(
(cid:3)
(cid:3)
2
1
2
)
)
+
+
4
4
=
=
3
2
+
(
(
(cid:3)
(cid:3)
2
1
1
)
)
+
+
4
4
=
=
3
3
6
5
4
ði;xÞ ði;yÞ 7 ((cid:3)1)+4=3 (0)+4=4 7

154 C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158
| essential                          |             | to use   | the original |                            | range                      | table R     | designed        | in        | the   |     |     |     |
| ---------------------------------- | ----------- | -------- | ------------ | -------------------------- | -------------------------- | ----------- | --------------- | --------- | ----- | --- | --- | --- |
| embedding                          |             | phase    | in           | order                      | to figure                  | out         | the             | embedding |       |     |     |     |
| capacity                           |             | for each | sub-block    |                            | F. i Given                 | a           | sub-block       | F i       | with  |     |     |     |
| two                                | consecutive |          | pixels       | from                       | the                        | stego-image |                 | with      | their |     |     |     |
| pixelvaluesbeingP                  |             |          |              | andP                       | respectively,thedifference |             |                 |           |       |     |     |     |
|                                    |             |          | (i,x)        |                            | (i,y)                      |             |                 |           |       |     |     |     |
| valued                             | ofP         |          | andP         | canbederivedbyEq.(1).EachF |                            |             |                 |           |       |     |     |     |
|                                    | i           | (i,x)    |              | (i,y)                      |                            |             |                 |           | i     |     |     |     |
| canberelatedtoitsoptimalsub-rangeR |             |          |              |                            |                            |             | fromtheoriginal |           |       |     |     |     |
j
| table                            | R according       |     | to                                 | the difference |                          | value | d. i Hence,        | we    | can |     |     |     |
| -------------------------------- | ----------------- | --- | ---------------------------------- | -------------- | ------------------------ | ----- | ------------------ | ----- | --- | --- | --- | --- |
| computethewidthofthesub-rangebyw |                   |     |                                    |                |                          |       | =u (cid:3)l,andthe |       |     |     |     |     |
|                                  |                   |     |                                    |                |                          | j     | j                  | j     |     |     |     |     |
| numberofbitst                    |                   |     | ofthesecretdatacanbeextractedfromF |                |                          |       |                    |       |     |     |     |     |
|                                  |                   |     | i                                  |                |                          |       |                    |       | i   |     |     |     |
| byEq.                            | (1).Eventually,we |     |                                    |                | computetheremaindervalue |       |                    |       | of  |     |     |     |
| F                                | by using          | Eq. | (2)                                | and            | transform                | the   | remainder          | value |     |     |     |     |
i
| F       |            |               |           |        |                  |                 | t.          |           |       |     |     |     |
| ------- | ---------- | ------------- | --------- | ------ | ---------------- | --------------- | ----------- | --------- | ----- | --- | --- | --- |
| rem(i)  | into       | a binary      |           | string | with the         | length          | i           | After     | that, |     |     |     |
| the     | extracting |               | algorithm |        | is accomplished. |                 | For         | example,  |       |     |     |     |
| assume  | two        | successive    |           | pixel  | values           | of the          | stego-image |           | are   |     |     |     |
| P       | =34        | and           | P =33,    |        | and the          | hidden          | capacity    | is 3bits  |       |     |     |     |
| (i,x)   |            |               | (i,y)     |        |                  |                 |             |           |       |     |     |     |
| (i.e.   | t =3).     | F             | can       | be     | gained by        | (33+34)mod23=3. |             |           |       |     |     |     |
|         | i          | rem(i)        |           |        |                  |                 |             |           |       |     |     |     |
| Convert |            | the remainder |           | value  | 3 into           | a binary        | string      | whose     |       |     |     |     |
| length  | is         | 3, and        | then      | we     | have 3           | =011            | .           | That      | is to |     |     |     |
|         |            |               |           |        |                  | (10)            | (2)         |           |       |     |     |     |
| say,    | the        | secret        | data      | 011    | is retrieved     | from            | the         | sub-block |       |     |     |     |
(2)
| in   | which        | the pixel | values  | are | P (i,x)  | =34 and | P (i,y) | =33. |     |     |     |     |
| ---- | ------------ | --------- | ------- | --- | -------- | ------- | ------- | ---- | --- | --- | --- | --- |
| 4.   | Experimental |           | results | and | analysis |         |         |      |     |     |     |     |
| 4.1. | Experimental |           | results |     |          |         |         |      |     |     |     |     |
Inthissection,weshallpresentourexperimentalresults
todemonstratetheproposedalgorithmcanperformbetter
| than | Wu  | and | Tsai’s | scheme. | We designed |     | a range | table | R   |     |     |     |
| ---- | --- | --- | ------ | ------- | ----------- | --- | ------- | ----- | --- | --- | --- | --- |
consistingof6sub-rangesR,forj=1,2,...,6,wheretheir
j
widthswere8,8,16,32,64,and128respectively.Therange
| of        | each      | R j was       | R           | 1 =[0,7],    | R 2             | =[8,15],      | R        | 3 =[16,31], |      |     |     |     |
| --------- | --------- | ------------- | ----------- | ------------ | --------------- | ------------- | -------- | ----------- | ---- | --- | --- | --- |
| R         | =[32,63], |               | R =[64,127] |              | and             | R =[128,255]. |          | Twelve      |      |     |     |     |
| 4         |           |               | 5           |              |                 | 6             |          |             |      |     |     |     |
| cover     | images    |               | ‘‘Lena’’,   |              | ‘‘Baboon’’,     | ‘‘Peppers’’,  |          | ‘‘Jet’’,    |      |     |     |     |
| ‘‘Tank’’, |           | ‘‘Airplane’’, |             | ‘‘Truck’’,   |                 | ‘‘Elaine’’,   |          | ‘‘Couple’’, |      |     |     |     |
| ‘‘Boat’’, |           | ‘‘Man’’,      | and         | ‘‘Tiffany’’, | shown           | in            | Figs.    | 1–3,        | were |     |     |     |
| used      | as test   | images        | in          | our          | experiments.    | The           | size     | of all      | the  |     |     |     |
| cover     | images    | was           | 512·512.    |              | We used         | a             | series   | of pseudo-  |      |     |     |     |
| random    |           | numbers       | as          | the secret   | data            | to be         | embedded |             | into |     |     |     |
| the       | cover     | images.       | The         | peak         | signal-to-noise |               | ratio    | (PSNR)      |      |     |     |     |
wasutilizedtoevaluatethestego-imagequality.ThePSNR
| is defined |     | as follows: |     |     |     |     |     |     |     |     |     |     |
| ---------- | --- | ----------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
2552
| PSNR¼10log |     |     |     | dB  |     |     |     |     |     |     |     |     |
| ---------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
10MSE
Fig.1. Thesizeofeachstego-imageis512·512:(a),(c),(e),and(g)are
thestego-imagesproducedbyWuandTsai’sscheme;(b),(d),(f),and(h)
and
arethestego-imagesproducedbyourmethod.
|      |     | (cid:2) | (cid:3)     |             |             |     |     |     |     |     |     |     |
| ---- | --- | ------- | ----------- | ----------- | ----------- | --- | --- | --- | --- | --- | --- | --- |
|      |     | 1       | X M(cid:3)1 | X N(cid:3)1 |             |     |     |     |     |     |     |     |
| MSE¼ |     |         |             |             | ða (cid:3)b | Þ2: |     |     |     |     |     |     |
i;j i;j
M (cid:2)N The results in parts (a), (c), (e), and (g) of Figs. 1–3 are
|     |     |     | i¼0 | j¼0 |     |     |     |     |                  |          |                  |             |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---------------- | -------- | ---------------- | ----------- |
|     |     |     |     |     |     |     |     |     | the stego-images | produced | by Wu and Tsai’s | method, and |
Here, a is the pixel of the cover image where the coordi- those in parts (b), (d), (f), and (h) of Figs. 1–3 are the
i,j
nate is (i,j), and b is the pixel of the stego-image where stego-imagesproducedbytheproposedmethod.Asthefig-
i,j
thecoordinateis(i,j).MandNrepresentthesizeoftheim- ures show, whether it is our scheme or Wu and Tsai’s
age. A larger PSNR value indicates the fact that the dis- scheme,therearenotanyvisualartifactspresent.However,
crepancy between the cover image and the stego-image is the PSNR values obtained demonstrate that the proposed
more invisible to the human eye. scheme is superior to Wu and Tsai’s scheme (see Table 4).

C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158 155
Fig.2. Thesizeofeachstego-imageis512·512:(a),(c),(e),and(g)are
thestego-imagesproducedbyWuandTsai’sscheme;(b),(d),(f),and(h)
Fig.3. Thesizeofeachstego-imageis512·512:(a),(c),(e),and(g)are
arethestego-imagesproducedbyourmethod.
thestego-imagesproducedbyWuandTsai’sscheme;(b),(d),(f),and(h)
arethestego-imagesproducedbyourmethod.
In Table 4, we see that the PSNR values given by our
method where increased by 2.5–3.3dB. This is because the is no doubt that the stego-image quality produced by the
distortion of the edge areas can be greatly improved by proposed scheme was quite good with no visible difference
theproposedscheme.Fig.4showsthatthemajordifference from the original cover image.
between Wu and Tsai’s scheme and our scheme lies in the Finally, we have also compared the proposed scheme
edgesoftheimageaftersecretdataembedding.Fig.4shows with the two-side match scheme by Chang and Tseng
thegray-levelvaluesscaledtwentytimes.Asaresult,there (2004). The two-side match method is similar to Wu and

156 C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158
Table4
The results of embedding the same random message by Wu and Tsai’s
includingtheproposedmethods
Cover-images WuandTsai’smethod Ourmethod
(512·512)
Capacity PSNR(dB) Capacity PSNR
(bytes) (bytes) (dB)
Lena 51,219 41.1 51,219 44.1
Baboon 57,146 37 57,146 40.3
Peppers 50,907 40.8 50,907 43.3
Jet 51,224 40.6 51,224 43.5
Tank 50,449 42.4 50,449 45.3
Airplane 49,739 42.2 49,739 45.2
Truck 50,065 42.9 50,065 45.6
Elaine 51,074 41.9 51,074 44.8
Couple 51,603 40.2 51,603 43.5
Boat 52,635 38.9 52,635 42.1
Man 52,945 39.1 52,945 42.1
Tiffany 50,920 40.8 50,920 43.9
Tsai’s scheme in the way that two consecutive pixels are
picked out each time to hide data. The comparison results
areshowninTable5,wherethePSNRvaluesdemonstrate
that the proposed scheme can improve the stego-image
quality of Chang and Tseng’s scheme.
4.2. Analysis and discussions
Inthissection,weanalyzetheperformanceofPVDand
that of the proposed method in terms of the stego-image
qualityandtherobustnessagainsttheRSdetectionattack.
To evaluate the schemes in terms of the stego-image qual-
ity,wecancheckoutboththeoptimalstego-imagequality,
wheretheminimumpixelvaluealterationhappens,andthe
worststego-imagequality,wherethemaximumpixel-value
alteration happens. First, we present a simple example to
show the optimal case of the PVD method. Assume the
secret data is 3bits, and the pixel values are 30 and 34
respectively. All the possibilities of modifying the pixel
values 30 and 34 such that d ¼t0 are shown in Table 6.
i i
In Table 6, we can see the maximum variation of single
pixel value is 2. In this optimal case for Wu and Tsai’s
scheme, the original difference value d is approximated
i
to ð2ti(cid:3)1Þ. Naturally, if the original difference value d is
i
approximated to 0 or 2ti, then it will make the worst case.
An example of the worst case can be seen in Table 1. In Fig.4. Thedifferenceimagesbetweenthestego-imageofWuandTsai’s
schemeandtheproposedscheme.
Table1,theoriginaldifferencevalueis0andthemaximum
modification of pixel value is 4. Apparently the worst case
wastesaboutdoublethestego-imagequalityoftheoptimal stego-image based on the remainder value of the two con-
case. The stego-image quality of PVD method can vary secutive pixels.
between the optimal case and the worst case. However, In addition, the proposed scheme is secure against the
there is only the optimal case when the proposed optimal RSdetectionattack.TheRSdetectionmethodbyFridrich
embedding algorithm is used. In our scheme, assume the et al. (2001) can directly judge whether the stego-image is
secret data is 3bits. Then, the maximum modification of secure without visual inspection. Fridrich et al. utilize the
pixel value is 2 whether the original remainder value dual statistics method to classify all the pixels of a stego-
approximates 0 or 2ti(cid:3)1 or 2ti. Take Table 2 for example. image into three pixel groups: the regular group R or
m
In spite of that fact that the original remainder approxi- R , the singular group S or S , and the unusable
(cid:3)m m (cid:3)m
mates0,themaximumvariationofpixelvalueis2.Accord- group.Thestego-imagewillpasstheRSsteganalysiswhen
ingly,theproposedmethodcanreducethedistortionofthe R ffiR and S ffiS . Otherwise, the stego-image will
m (cid:3)m m (cid:3)m

C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158 157
| Table5 |     |     |     |     | values | of R | and S | are | almost | equal | to those | of R     |
| ------ | --- | --- | --- | --- | ------ | ---- | ----- | --- | ------ | ----- | -------- | -------- |
|        |     |     |     |     |        | m    |       | m   |        |       |          | (cid:3)m |
TheresultsofembeddingthesamerandommessagebyChanandTseng’s and S respectively. Moreover, we have also tested the
(cid:3)m
includingtheproposedmethods
|     |     |     |     |     | other stego-images |     |     | processed |     | by using | the | proposed |
| --- | --- | --- | --- | --- | ------------------ | --- | --- | --------- | --- | -------- | --- | -------- |
Cover-images ChanandTseng’s Ourmethod scheme, and the detection results are the same as what
(512·512) method Fig.5reveals.Accordingly,wecanmakeasolidstatement
|     | Capacity | PSNR | Capacity | PSNR |     |     |     |     |     |     |     |     |
| --- | -------- | ---- | -------- | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
thattheproposedschemeissecureagainsttheRSdetection
|     | (bytes) | (dB) | (bytes) | (dB) |     |     |     |     |     |     |     |     |
| --- | ------- | ---- | ------- | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
attack.
| Lena     | 48,626 | 41.2 | 51,219 | 44.1 |                |                |              |         |        |          |         |            |
| -------- | ------ | ---- | ------ | ---- | -------------- | -------------- | ------------ | ------- | ------ | -------- | ------- | ---------- |
| Baboon   | 57,146 | 34.1 | 57,146 | 40.3 |                |                |              |         |        |          |         |            |
| Peppers  | 50,907 | 40.6 | 50,907 | 43.3 | 5. Conclusions |                |              |         |        |          |         |            |
| Jet      | 51,224 | 40.3 | 51,224 | 43.5 |                |                |              |         |        |          |         |            |
| Tank     | 50,449 | 41.7 | 50,449 | 45.3 |                |                |              |         |        |          |         |            |
|          |        |      |        |      | In this        | paper,         | we           | propose | a      | novel    | scheme  | to greatly |
| Airplane | 41,829 | 42.7 | 49,739 | 45.2 |                |                |              |         |        |          |         |            |
|          |        |      |        |      | reduce         | the visibility |              | of the  | hiding | effect   | present | in the     |
| Truck    | 50,065 | 42.2 | 50,065 | 45.6 |                |                |              |         |        |          |         |            |
|          |        |      |        |      | PVD method.    |                | The proposed |         | scheme | utilizes | the     | remainder  |
| Elaine   | 51,074 | 40.8 | 51,074 | 44.8 |                |                |              |         |        |          |         |            |
Couple 51,603 37.1 51,603 43.5 of the two consecutive pixels to record the information of
Boat 52,635 38.7 52,635 42.1 the secret data which gains more flexibility, capable of
| Man | 52,945 | 38.3 | 52,945 | 42.1 |     |     |     |     |     |     |     |     |
| --- | ------ | ---- | ------ | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
derivingtheoptimalremainderofthetwopixelsattheleast
| Tiffany | 50,920 | 41.2 | 50,920 | 43.9 |     |     |     |     |     |     |     |     |
| ------- | ------ | ---- | ------ | ---- | --- | --- | --- | --- | --- | --- | --- | --- |
distortion.Thehidingeffectthatappearsinthestego-image
|     |     |     |     |     | when WuandTsai’s |               |     | scheme    | isused | to       | hidethe  | secret data |
| --- | --- | --- | --- | --- | ---------------- | ------------- | --- | --------- | ------ | -------- | -------- | ----------- |
|     |     |     |     |     | can be           | significantly |     | decreased | by     | the      | proposed | optimal     |
|     |     |     |     |     | embedding        | algorithm.    |     | Besides,  | the    | proposed |          | method can  |
Table6
AnillustrationofoptimalcasebyusingWuandTsai’smethod alsosolvethefalling-off-boundaryproblembyre-adjusting
|                |             |             |                    |            | the remainder |     | of the  | two pixels,  |     | staying | secure | against the |
| -------------- | ----------- | ----------- | ------------------ | ---------- | ------------- | --- | ------- | ------------ | --- | ------- | ------ | ----------- |
| Secretdata     | P (i,x) =30 | P (i,y) =34 | Newdifferencevalue |            |               |     |         |              |     |         |        |             |
|                |             |             |                    |            | RS detection  |     | attack. | Experimental |     | results | show   | the pro-    |
| (decimalvalue) |             |             | ofP (i,x)          | andP (i,y) |               |     |         |              |     |         |        |             |
0 +2 (cid:3)2 0 posed scheme has a much better performance than Wu
1 +1 (cid:3)2 1 and Tsai’s scheme in terms of stego-image quality.
| 2   | +1       | (cid:3)1 | 2   |     |     |     |     |     |     |     |     |     |
| --- | -------- | -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3   | Nomodify | (cid:3)1 | 3   |     |     |     |     |     |     |     |     |     |
| 4   | Nomodify | Nomodify | 4   |     |     |     |     |     |     |     |     |     |
Acknowledgements
| 5   | Nomodify | +1  | 5   |     |     |     |     |     |     |     |     |     |
| --- | -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6   | (cid:3)1 | +1  | 6   |     |     |     |     |     |     |     |     |     |
7 (cid:3)1 +2 7 We thank many anonymous referees for their sugges-
tionstoimprovethispaper.Thisworkissupportedinpart
|     |     |     |     |     | by National |        | Science  | Council | and     | Taiwan |     | Information |
| --- | --- | --- | --- | --- | ----------- | ------ | -------- | ------- | ------- | ------ | --- | ----------- |
|     |     |     |     |     | Security    | Center | at NCTU, |         | Taiwan, | ROC.   |     |             |
60
Rm
Sm
R—m
|     |     |     |     | S—m | References |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | ---------- | --- | --- | --- | --- | --- | --- | --- |
50
|     |     |     |     |     | Chan, C.K., | Cheng, | L.M., | 2004. | Hiding | data in | images | by simple LSB |
| --- | --- | --- | --- | --- | ----------- | ------ | ----- | ----- | ------ | ------- | ------ | ------------- |
40
substitution.PatternRecognition37(March),469–474.
|     |     |     |     |     | Chang, C.C., | Tseng, | H.W., | 2004. | A steganographic |     | method | for digital |
| --- | --- | --- | --- | --- | ------------ | ------ | ----- | ----- | ---------------- | --- | ------ | ----------- |
30 imagesusingsidematch.PatternRecognitionLetter25(September),
1431–1437.
|     |     |     |     |     | Chang, C.C., | Hsiao, | J.Y., | Chan, | C.S., | 2003. | Finding | optimal least- |
| --- | --- | --- | --- | --- | ------------ | ------ | ----- | ----- | ----- | ----- | ------- | -------------- |
20
significant-bitsubstitutioninimagehidingbydynamicprogramming
strategy.PatternRecognition36(July),1583–1595.
Feng,J.B.,Lin,I.C.,Tsai,C.S.,Chu,Y.P.,2006.Reversiblewatermark-
10
|     |     |     |     |     | ing: current | status | and | key issues. | International |     | Journal | of Network |
| --- | --- | --- | --- | --- | ------------ | ------ | --- | ----------- | ------------- | --- | ------- | ---------- |
Security2(May),161–170.
0 Fridrich, J., Goljan, M., Du, R., 2001. Reliable detection of LSB
| 0 10 | 20 30 | 40 50 60 | 70 80 | 90 100 |     |     |     |     |     |     |     |     |
| ---- | ----- | -------- | ----- | ------ | --- | --- | --- | --- | --- | --- | --- | --- |
steganographyincolorandgrayscaleimages.In:ProceedingsofACM
Fig. 5. TheRS-diagramyieldsby thedualstatisticsdetectingforstego- WorkshoponMultimediaandSecurity,pp.27–30.
imageproducedbytheproposedscheme. Ker,A.D.,2004.QuantitativeevaluationofpairsandRSsteganalysis.In:
ProceedingsoftheSPIESecurity,Steganography,andWatermarking
ofMultimediaContents,vol.5306,pp.83–97.
be judged as a suspicious object. The detection results our Liao, Z., Huang, Y., Li, C., 2007. Research on data hiding capacity.
schemegave(withthestego-imagebeingtheoneinFig.1b) InternationalJournalofNetworkSecurity5(September),140–144.
are shown in Fig. 5, where the x-axis represents the per- Lin,C.C.,Tsai,W.H.,2004.Secretimagesharingwithsteganographyand
authentication.TheJournalofSystemsandSoftware73(November),
| centage of | hiding capacity | and the y-axis | the | percentage |     |     |     |     |     |     |     |     |
| ---------- | --------------- | -------------- | --- | ---------- | --- | --- | --- | --- | --- | --- | --- | --- |
405–414.
| of the regular | and singular | pixel | groups with | masks |     |     |     |     |     |     |     |     |
| -------------- | ------------ | ----- | ----------- | ----- | --- | --- | --- | --- | --- | --- | --- | --- |
Lou,D.C.,Liu,J.L.,2002.Steganographicmethodforsecurecommuni-
m=[0110] and(cid:3)m=[0(cid:3)1(cid:3)10]. In Fig. 5, the expected cations.ComputersandSecurity21(October),449–460.

158 C.-M.Wangetal./TheJournalofSystemsandSoftware81(2008)150–158
Petitcolas,F.A.P.,Anderson,R.J.,Kuhn,M.G.,1999.Informationhiding Wang, R.Z., Lin, C.F., Lin, J.C., 2001. Image hiding by optimal LSB
–asurvey.In:ProceedingsoftheIEEESpecialIssueonIdentification substitution and genetic algorithm. Pattern Recognition 34 (March),
andProtectionofMultimediaContent,vol.87,pp.1062–1078. 671–683.
Simmons,G.J.,1984.Theprisoners’problemandthesubliminalchannel. Wu,N.I.,Hwang,M.S.,2007.Datahiding:currentstatusandkeyissues.
In:ProceedingsofCrypto’83,pp.51–67. InternationalJournalofNetworkSecurity4(January),1–9.
Thien,C.C.,Lin,J.C.,2003.A simpleandhigh-hiding capacitymethod Wu, M., Liu, B., 2004. Data hiding in binary image for authentication
for hiding digit-by-digit data in images based on modulus function. andannotation.IEEETransactionsonMultimedia6(August),528–
PatternRecognition36(December),2875–2881. 538.
Tseng, Y.C., Pan, H.K., 2002. Data hiding in 2-color images. IEEE Wu, D.C., Tsai, W.H., 2003. A steganographic method for images by
TransactionsonComputers51(July),873–878. pixel-valuedifferencing.PatternRecognitionLetters24(June),1613–
Tseng,Y.C.,Chen,Y.Y.,Pan,H.K.,2002.Asecuredatahidingscheme 1626.
for binary images. IEEE Transactions on Communications 50 Wu, H.C., Wu, N.I., Tsai, C.S., Hwang, M.S., 2005. Image stegano-
(August),1227–1231. graphicschemebasedonpixel-valuedifferencingandLSBreplacement
Wang, S.J., 2005. Steganography of capacity required using modulo methods.IEEProceedings–VisionImageandSignalProcessing152
operator for embedding secret image. Applied Mathematics and (October),611–615.
Computation164(May),99–116. Zhong,S.,Cheng,X.,Chen,T.,2007.DatahidinginakindofPDFtexts
Wang, C.M., Wang, P.C., 2006. Steganography on point-sampled forsecretcommunication.InternationalJournalofNetworkSecurity4
geometry.ComputersandGraphics12(April),244–254. (January),17–26.
